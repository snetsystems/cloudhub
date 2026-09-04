package server

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// The alert must be generated from the stored thresholds, so the script and the
// dashboard cell cannot judge a port differently.
func TestRenderOpticsTickScriptCarriesThresholds(t *testing.T) {
	s := &Service{
		Logger: log.New(log.DebugLevel),
		InternalENV: cloudhub.InternalEnvironment{
			TemplatesManager: &ConfigTemplatesManager{
				Logger: log.New(log.DebugLevel),
				Path:   "does-not-exist",
			},
		},
	}

	script, err := renderOpticsTickScript(context.Background(), s, "Default",
		&cloudhub.OpticsThreshold{RxLowDbm: -17, TxLowDbm: -20.5, TempHighC: 75, AlertEnabled: true})
	if err != nil {
		t.Fatalf("renderOpticsTickScript: %v", err)
	}

	for _, want := range []string{
		// Float literals: `-17` would read as an integer in TICKscript and
		// default() would then write an int into a float field.
		"var rxLowDbm = -17.0",
		"var txLowDbm = -20.5",
		"var tempHighC = 75.0",
		"|default()",
		"measurement('snmp_nx')",
		"stateChangesOnly()",
		"measurement('cloudhub_alerts')",
	} {
		if !strings.Contains(script, want) {
			t.Errorf("rendered script missing %q", want)
		}
	}

	// A template placeholder that survives rendering means the alert would name
	// nothing useful.
	if strings.Contains(script, "{{.RxLowDbm}}") {
		t.Error("threshold placeholder was not substituted")
	}
}

// Turning alerting off has to remove the task, not leave a stale one running.
func TestApplyOpticsAlertTaskWithoutKapacitor(t *testing.T) {
	s := &Service{
		Logger: log.New(log.DebugLevel),
		Store: &mocks.Store{
			OrganizationsStore: &mocks.OrganizationsStore{
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "default", Name: "Default"}, nil
				},
			},
		},
	}

	err := applyOpticsAlertTask(context.Background(), s, "default", &cloudhub.NetworkDeviceOrg{
		ID:              "default",
		OpticsThreshold: &cloudhub.OpticsThreshold{RxLowDbm: -17, AlertEnabled: true},
	})
	if err == nil || !strings.Contains(err.Error(), "kapacitor") {
		t.Errorf("expected a kapacitor-not-configured error, got %v", err)
	}
}

// The Kapacitor is the operator's explicit choice, not something derived from
// the data source (a source can have several) and not the prediction one (that
// script needs a GPU-backed UDF).
func TestOpticsKapacitorUsesTheSelectedServer(t *testing.T) {
	s := &Service{
		Logger: log.New(log.DebugLevel),
		Store: &mocks.Store{
			ServersStore: &mocks.ServersStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
					if id != 42 {
						return cloudhub.Server{}, cloudhub.ErrServerNotFound
					}
					return cloudhub.Server{ID: 42, URL: "http://kapacitor.example:9092"}, nil
				},
			},
		},
	}

	deviceOrg := &cloudhub.NetworkDeviceOrg{
		ID:                "default",
		OpticsKapacitorID: 42,
		// Deliberately different, to prove it is not consulted.
		AIKapacitor: cloudhub.AIKapacitor{KapaURL: "http://prediction-gpu:9092"},
	}

	c, err := opticsKapacitorClient(context.Background(), s, "default", deviceOrg)
	if err != nil {
		t.Fatalf("opticsKapacitorClient: %v", err)
	}
	if c.URL != "http://kapacitor.example:9092" {
		t.Errorf("client URL = %q, want the selected kapacitor", c.URL)
	}

	deviceOrg.OpticsKapacitorID = 0
	if _, err := opticsKapacitorClient(context.Background(), s, "default", deviceOrg); err == nil {
		t.Error("expected an error when no kapacitor has been selected")
	}
}

// Only a real threshold change should reach Kapacitor; an organization edited
// for some other reason must not trigger a task rewrite.
func TestOpticsThresholdChanged(t *testing.T) {
	a := &cloudhub.OpticsThreshold{RxLowDbm: -17, TxLowDbm: -17, TempHighC: 75}
	sameValue := &cloudhub.OpticsThreshold{RxLowDbm: -17, TxLowDbm: -17, TempHighC: 75}

	cases := []struct {
		name          string
		before, after *cloudhub.OpticsThreshold
		want          bool
	}{
		{"never configured", nil, nil, false},
		{"same values, different pointers", a, sameValue, false},
		{"first time configured", nil, a, true},
		{"cleared", a, nil, true},
		{"threshold edited", a, &cloudhub.OpticsThreshold{RxLowDbm: -20, TxLowDbm: -17, TempHighC: 75}, true},
		{"alerting toggled", a, &cloudhub.OpticsThreshold{RxLowDbm: -17, TxLowDbm: -17, TempHighC: 75, AlertEnabled: true}, true},
	}

	for _, tc := range cases {
		if got := opticsThresholdChanged(tc.before, tc.after); got != tc.want {
			t.Errorf("%s: opticsThresholdChanged = %v, want %v", tc.name, got, tc.want)
		}
	}
}

// Moving the alert to a different Kapacitor has to clear the old task, or the
// same fault is reported twice from two Kapacitors.
func TestRemoveOpticsAlertTaskFromPreviousKapacitor(t *testing.T) {
	lookedUp := 0
	s := &Service{
		Logger: log.New(log.DebugLevel),
		Store: &mocks.Store{
			ServersStore: &mocks.ServersStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
					lookedUp = id
					return cloudhub.Server{}, cloudhub.ErrServerNotFound
				},
			},
		},
	}

	// The connection is unreachable here, so this only proves the previous
	// selection is the one consulted — not the current one.
	_ = removeOpticsAlertTaskFrom(context.Background(), s, 7, "default")
	if lookedUp != 7 {
		t.Errorf("looked up server %d, want the previously selected 7", lookedUp)
	}
}

// Kapacitor IDs are 19 digits, past what a JavaScript number holds exactly, so
// they have to cross the wire as strings or the browser rounds them and the
// server looks up an ID that does not exist.
func TestOpticsKapacitorIDSurvivesJSON(t *testing.T) {
	const id = 1195634893892644864

	encoded, err := json.Marshal(&deviceOrgResponse{OpticsKapacitorID: id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), `"optics_kapacitor_id":"1195634893892644864"`) {
		t.Errorf("id was not encoded as a string: %s", encoded)
	}

	var req updateDeviceOrgRequest
	if err := json.Unmarshal(
		[]byte(`{"optics_kapacitor_id":"1195634893892644864"}`), &req,
	); err != nil {
		t.Fatal(err)
	}
	if req.OpticsKapacitorID == nil || *req.OpticsKapacitorID != id {
		t.Errorf("decoded id = %v, want %d", req.OpticsKapacitorID, id)
	}
}
