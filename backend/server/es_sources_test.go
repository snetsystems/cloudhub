// server/es_sources_test.go
package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/server"
)

// fakeESServer returns a server that responds to ES Info ("/") with a version
// and the required X-Elastic-Product header, so that the ES client treats it
// as a valid Elasticsearch cluster.
func fakeESServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		w.Write([]byte(`{"version":{"number":"8.10.1"}}`))
	})
	return httptest.NewServer(mux)
}

// minimal struct for decoding NewEsSource response
type esSourceResp struct {
	ID                   string            `json:"id"`
	AuthenticationMethod string            `json:"authentication"`
	Links                map[string]string `json:"links"`
}

func TestNewEsSource_Success(t *testing.T) {
	es := fakeESServer()
	defer es.Close()

	svc := &server.Service{
		Store: &mocks.Store{
			EsSourcesStore: &mocks.EsSourcesStore{
				AddF: func(ctx context.Context, src cloudhub.EsSource) (cloudhub.EsSource, error) {
					src.ID = 42
					return src, nil
				},
			},
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org1"}, nil
				},
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	reqBody, _ := json.Marshal(cloudhub.EsSource{
		Name:           "MyCluster",
		URL:            es.URL,
		BasicAuth:      &cloudhub.BasicAuth{Username: "u", Password: "p"},
		Authentication: "basic",
		Organization:   "org1",
	})
	req := httptest.NewRequest("POST", "/cloudhub/v1/es", bytes.NewReader(reqBody))
	rw := httptest.NewRecorder()

	svc.NewEsSource(rw, req)

	res := rw.Result()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", res.StatusCode)
	}

	var resp esSourceResp
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.ID != "42" {
		t.Errorf("expected ID 42, got %q", resp.ID)
	}
	if resp.AuthenticationMethod != "basic" {
		t.Errorf("expected auth 'basic', got %q", resp.AuthenticationMethod)
	}
	if self, ok := resp.Links["self"]; !ok || !strings.HasSuffix(self, "/cloudhub/v1/es/42") {
		t.Errorf("unexpected self link: %v", resp.Links)
	}
}

func TestEsSources_And_EsSourcesID(t *testing.T) {
	es := fakeESServer()
	defer es.Close()

	sources := []cloudhub.EsSource{
		{ID: 1, URL: es.URL, BasicAuth: &cloudhub.BasicAuth{}},
		{ID: 2, URL: es.URL, BasicAuth: &cloudhub.BasicAuth{}},
	}
	store := &mocks.EsSourcesStore{
		AllF: func(ctx context.Context) ([]cloudhub.EsSource, error) {
			return sources, nil
		},
		GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
			for _, s := range sources {
				if s.ID == id {
					return s, nil
				}
			}
			return cloudhub.EsSource{}, fmt.Errorf("not found")
		},
	}
	svc := &server.Service{
		Store: &mocks.Store{
			EsSourcesStore: store,
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org"}, nil
				},
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	// GET /cloudhub/v1/es
	rw := httptest.NewRecorder()
	svc.EsSources(rw, httptest.NewRequest("GET", "/cloudhub/v1/es", nil))
	if rw.Result().StatusCode != http.StatusOK {
		t.Errorf("EsSources expected 200, got %d", rw.Result().StatusCode)
	}
	var list struct {
		EsSources []map[string]interface{} `json:"esSources"`
	}
	if err := json.NewDecoder(rw.Body).Decode(&list); err != nil {
		t.Fatalf("decode list error: %v", err)
	}
	if len(list.EsSources) != 2 {
		t.Errorf("expected 2 sources, got %d", len(list.EsSources))
	}

	// GET /cloudhub/v1/es/2
	req := httptest.NewRequest("GET", "/cloudhub/v1/es/2", nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "2"}}))
	rw2 := httptest.NewRecorder()
	svc.EsSourcesID(rw2, req)
	if rw2.Result().StatusCode != http.StatusOK {
		t.Errorf("EsSourcesID expected 200, got %d", rw2.Result().StatusCode)
	}
	var single map[string]interface{}
	if err := json.NewDecoder(rw2.Body).Decode(&single); err != nil {
		t.Fatalf("decode single error: %v", err)
	}
	if single["id"] != "2" {
		t.Errorf("expected id '2', got %v", single["id"])
	}
}

func TestUpdateAndRemoveEsSource(t *testing.T) {
	es := fakeESServer()
	defer es.Close()

	saved := cloudhub.EsSource{ID: 7, URL: es.URL, BasicAuth: &cloudhub.BasicAuth{}, Organization: "org", Authentication: "basic"}
	updatedCalled := false
	removedCalled := false
	store := &mocks.EsSourcesStore{
		GetF:    func(ctx context.Context, id int) (cloudhub.EsSource, error) { return saved, nil },
		UpdateF: func(ctx context.Context, src cloudhub.EsSource) error { updatedCalled = true; return nil },
		DeleteF: func(ctx context.Context, src cloudhub.EsSource) error { removedCalled = true; return nil },
	}
	svc := &server.Service{
		Store: &mocks.Store{
			EsSourcesStore: store,
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org"}, nil
				},
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	// PATCH /cloudhub/v1/es/7
	upd := `{"defaultIndex":"idx"}`
	req := httptest.NewRequest("PATCH", "/cloudhub/v1/es/7", strings.NewReader(upd))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "7"}}))
	rw := httptest.NewRecorder()
	svc.UpdateEsSource(rw, req)
	if !updatedCalled {
		t.Error("expected Update to be called")
	}
	if rw.Result().StatusCode != http.StatusOK {
		t.Errorf("UpdateEsSource expected 200, got %d", rw.Result().StatusCode)
	}

	// DELETE /cloudhub/v1/es/7
	req2 := httptest.NewRequest("DELETE", "/cloudhub/v1/es/7", nil)
	req2 = req2.WithContext(httprouter.WithParams(req2.Context(), httprouter.Params{{Key: "id", Value: "7"}}))
	rw2 := httptest.NewRecorder()
	svc.RemoveEsSource(rw2, req2)
	if !removedCalled {
		t.Error("expected Delete to be called")
	}
	if rw2.Result().StatusCode != http.StatusNoContent {
		t.Errorf("RemoveEsSource expected 204, got %d", rw2.Result().StatusCode)
	}
}

func TestEsSourceHealth_Success(t *testing.T) {
	es := fakeESServer()
	defer es.Close()

	src := cloudhub.EsSource{ID: 5, URL: es.URL, BasicAuth: &cloudhub.BasicAuth{}, Organization: "org", Authentication: "basic"}
	store := &mocks.EsSourcesStore{
		GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) { return src, nil },
	}
	svc := &server.Service{
		Store: &mocks.Store{
			EsSourcesStore: store,
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org"}, nil
				},
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	req := httptest.NewRequest("GET", "/cloudhub/v1/es/5/health", nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "5"}}))
	rw := httptest.NewRecorder()
	svc.EsSourceHealth(rw, req)
	if rw.Result().StatusCode != http.StatusNoContent {
		t.Errorf("EsSourceHealth expected 204, got %d", rw.Result().StatusCode)
	}
}

func TestElasticProxy_BasicAuth(t *testing.T) {
	es := fakeESServer()
	defer es.Close()

	src := cloudhub.EsSource{ID: 8, URL: es.URL, BasicAuth: &cloudhub.BasicAuth{Username: "user", Password: "pass"}, Organization: "org", Authentication: "basic"}
	store := &mocks.EsSourcesStore{
		GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) { return src, nil },
	}
	svc := &server.Service{
		Store: &mocks.Store{
			EsSourcesStore: store,
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org"}, nil
				},
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	req := httptest.NewRequest("GET", "/cloudhub/v1/es/8/proxy/", nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "8"}}))
	rw := httptest.NewRecorder()
	svc.Elastic(rw, req)
	if rw.Result().StatusCode != http.StatusOK {
		t.Errorf("Elastic proxy expected 200, got %d", rw.Result().StatusCode)
	}
}

func TestUpdateEsSource_OrganizationChange(t *testing.T) {
	es := fakeESServer()
	defer es.Close()

	saved := cloudhub.EsSource{
		ID:             9,
		URL:            es.URL,
		BasicAuth:      &cloudhub.BasicAuth{},
		Organization:   "oldOrg",
		Authentication: "basic",
	}

	var updatedSrc cloudhub.EsSource
	store := &mocks.EsSourcesStore{
		GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
			return saved, nil
		},
		UpdateF: func(ctx context.Context, src cloudhub.EsSource) error {
			updatedSrc = src
			return nil
		},
	}

	svc := &server.Service{
		Store: &mocks.Store{
			EsSourcesStore: store,
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org"}, nil
				},
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	body := `{"organization":"newOrg"}`
	req := httptest.NewRequest("PATCH", "/cloudhub/v1/es/9", strings.NewReader(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "id", Value: "9"},
	}))
	rw := httptest.NewRecorder()

	svc.UpdateEsSource(rw, req)

	if rw.Result().StatusCode != http.StatusOK {
		t.Fatalf("UpdateEsSource expected 200, got %d", rw.Result().StatusCode)
	}
	if updatedSrc.Organization != "newOrg" {
		t.Errorf("organization not updated: got %q, want %q", updatedSrc.Organization, "newOrg")
	}
}

func TestMultiElasticProxy(t *testing.T) {

	esOK := fakeESServer()
	defer esOK.Close()
	esErr := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Simulated failure", http.StatusInternalServerError)
	}))
	defer esErr.Close()

	sources := []cloudhub.EsSource{
		{ID: 1, URL: esOK.URL, BasicAuth: &cloudhub.BasicAuth{Username: "u", Password: "p"}, Organization: "org", Authentication: "basic"},
		{ID: 2, URL: esErr.URL, BasicAuth: &cloudhub.BasicAuth{Username: "u", Password: "p"}, Organization: "org", Authentication: "basic"},
	}
	store := &mocks.EsSourcesStore{
		GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
			for _, s := range sources {
				if s.ID == id {
					return s, nil
				}
			}
			return cloudhub.EsSource{}, fmt.Errorf("not found")
		},
	}
	svc := &server.Service{
		Store: &mocks.Store{
			EsSourcesStore: store,
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org"}, nil
				},
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	multiReq := cloudhub.MultiProxyRequest{
		SourceIds: []string{"1", "2"},
		Method:    "POST",
		Path:      "/_search",
		Body: map[string]interface{}{
			"query": map[string]interface{}{"match_all": map[string]interface{}{}},
			"size":  1,
		},
	}
	reqBody, _ := json.Marshal(multiReq)
	req := httptest.NewRequest("POST", "/cloudhub/v1/es/multi/proxy", bytes.NewReader(reqBody))
	rw := httptest.NewRecorder()

	svc.MultiElasticProxy(rw, req)
	res := rw.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}

	var resp []cloudhub.MultiProxyResult
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(resp) != 2 {
		t.Fatalf("expected 2 results, got %d", len(resp))
	}

	foundOK, foundErr := false, false
	for _, r := range resp {
		switch r.SourceID {
		case "1":
			if r.Status != 200 {
				t.Errorf("expected status 200 for source 1, got %d", r.Status)
			}
			if r.Data == nil {
				t.Errorf("expected data for source 1, got nil")
			}
			foundOK = true
		case "2":
			if r.Status != 500 {
				t.Errorf("expected status 500 for source 2, got %d", r.Status)
			}
			if r.Error == "" {
				t.Errorf("expected error for source 2, got empty")
			}
			foundErr = true
		default:
			t.Errorf("unexpected sourceId: %s", r.SourceID)
		}
	}
	if !foundOK || !foundErr {
		t.Errorf("results missing: foundOK=%v, foundErr=%v", foundOK, foundErr)
	}
}
