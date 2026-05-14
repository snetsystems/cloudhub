package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	kapackage "github.com/snetsystems/cloudhub/backend/kapacitor"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

type fakeAlertKapacitorStore struct {
	allFunc    func(context.Context, string) ([]cloudhub.AlertKapacitor, error)
	getFunc    func(context.Context, string) (cloudhub.AlertKapacitor, error)
	addFunc    func(context.Context, cloudhub.AlertKapacitor) (cloudhub.AlertKapacitor, error)
	updateFunc func(context.Context, cloudhub.AlertKapacitor) error
	deleteFunc func(context.Context, string) error
}

func (f *fakeAlertKapacitorStore) All(ctx context.Context, orgID string) ([]cloudhub.AlertKapacitor, error) {
	if f.allFunc != nil {
		return f.allFunc(ctx, orgID)
	}
	return nil, nil
}

func (f *fakeAlertKapacitorStore) Get(ctx context.Context, id string) (cloudhub.AlertKapacitor, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, id)
	}
	return cloudhub.AlertKapacitor{}, errors.New("not found")
}

func (f *fakeAlertKapacitorStore) Add(ctx context.Context, k cloudhub.AlertKapacitor) (cloudhub.AlertKapacitor, error) {
	if f.addFunc != nil {
		return f.addFunc(ctx, k)
	}
	return k, nil
}

func (f *fakeAlertKapacitorStore) Update(ctx context.Context, k cloudhub.AlertKapacitor) error {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, k)
	}
	return nil
}

func (f *fakeAlertKapacitorStore) Delete(ctx context.Context, id string) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, id)
	}
	return nil
}


type fakeAlertGroupRuleStore struct {
	addFunc              func(context.Context, cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error)
	updateFunc           func(context.Context, cloudhub.AlertGroupRule) error
	getFunc              func(context.Context, string) (cloudhub.AlertGroupRule, error)
	setHostsFunc         func(context.Context, string, []string) error
	setUserGroupsFunc    func(context.Context, string, []string) error
	userGroupsByRuleFunc func(context.Context, string) ([]cloudhub.UserGroup, error)
	rulesByUserGroupFunc func(context.Context, string) ([]cloudhub.AlertGroupRule, error)
}

func (f *fakeAlertGroupRuleStore) All(ctx context.Context, orgID string) ([]cloudhub.AlertGroupRule, error) {
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) Get(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, id)
	}
	return cloudhub.AlertGroupRule{}, errors.New("not found")
}

func (f *fakeAlertGroupRuleStore) Add(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
	if f.addFunc != nil {
		return f.addFunc(ctx, r)
	}
	return r, nil
}

func (f *fakeAlertGroupRuleStore) Update(ctx context.Context, r cloudhub.AlertGroupRule) error {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, r)
	}
	return nil
}

func (f *fakeAlertGroupRuleStore) Delete(ctx context.Context, id string) error {
	return nil
}

func (f *fakeAlertGroupRuleStore) SetHosts(ctx context.Context, ruleID string, hostnames []string) error {
	if f.setHostsFunc != nil {
		return f.setHostsFunc(ctx, ruleID, hostnames)
	}
	return nil
}

func (f *fakeAlertGroupRuleStore) SetUserGroups(ctx context.Context, ruleID string, userGroupIDs []string) error {
	if f.setUserGroupsFunc != nil {
		return f.setUserGroupsFunc(ctx, ruleID, userGroupIDs)
	}
	return nil
}

func (f *fakeAlertGroupRuleStore) Hostnames(ctx context.Context, ruleID string) ([]string, error) {
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) UserGroupsByRule(ctx context.Context, ruleID string) ([]cloudhub.UserGroup, error) {
	if f.userGroupsByRuleFunc != nil {
		return f.userGroupsByRuleFunc(ctx, ruleID)
	}
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) RulesByUserGroup(ctx context.Context, userGroupID string) ([]cloudhub.AlertGroupRule, error) {
	if f.rulesByUserGroupFunc != nil {
		return f.rulesByUserGroupFunc(ctx, userGroupID)
	}
	return nil, nil
}

type fakeAlertKapacitorMappingStore struct {
	putFunc    func(context.Context, int, int, string) error
	getFunc    func(context.Context, int, int) (string, error)
	deleteFunc func(context.Context, int, int) error
}

func (f *fakeAlertKapacitorMappingStore) Put(ctx context.Context, sourceID, legacyKapacitorID int, alertKapacitorID string) error {
	if f.putFunc != nil {
		return f.putFunc(ctx, sourceID, legacyKapacitorID, alertKapacitorID)
	}
	return nil
}

func (f *fakeAlertKapacitorMappingStore) GetAlertKapacitorID(ctx context.Context, sourceID, legacyKapacitorID int) (string, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, sourceID, legacyKapacitorID)
	}
	return "", errors.New("not found")
}

func (f *fakeAlertKapacitorMappingStore) Delete(ctx context.Context, sourceID, legacyKapacitorID int) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, sourceID, legacyKapacitorID)
	}
	return nil
}

type fakeUserGroupStore struct {
	allFunc    func(context.Context, string) ([]cloudhub.UserGroup, error)
	getFunc    func(context.Context, string) (cloudhub.UserGroup, error)
	addFunc    func(context.Context, cloudhub.UserGroup) (cloudhub.UserGroup, error)
	updateFunc func(context.Context, cloudhub.UserGroup) error
	deleteFunc func(context.Context, string) error
}

func (f *fakeUserGroupStore) All(ctx context.Context, orgID string) ([]cloudhub.UserGroup, error) {
	if f.allFunc != nil {
		return f.allFunc(ctx, orgID)
	}
	return nil, nil
}

func (f *fakeUserGroupStore) Get(ctx context.Context, id string) (cloudhub.UserGroup, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, id)
	}
	return cloudhub.UserGroup{}, errors.New("not found")
}

func (f *fakeUserGroupStore) Add(ctx context.Context, g cloudhub.UserGroup) (cloudhub.UserGroup, error) {
	if f.addFunc != nil {
		return f.addFunc(ctx, g)
	}
	return g, nil
}

func (f *fakeUserGroupStore) Update(ctx context.Context, g cloudhub.UserGroup) error {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, g)
	}
	return nil
}

func (f *fakeUserGroupStore) Delete(ctx context.Context, id string) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, id)
	}
	return nil
}

func TestNewKapacitorAlsoCreatesAlertKapacitor(t *testing.T) {
	logger := &mocks.TestLogger{}
	var synced []cloudhub.AlertKapacitor
	mappingSaved := false

	svc := &Service{
		Store: &mocks.Store{
			SourcesStore: &mocks.SourcesStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Source, error) {
					return cloudhub.Source{ID: id, URL: "http://influx.example"}, nil
				},
			},
			OrganizationsStore: &mocks.OrganizationsStore{
				DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org-1"}, nil
				},
			},
			ServersStore: &mocks.ServersStore{
				AddF: func(ctx context.Context, srv cloudhub.Server) (cloudhub.Server, error) {
					srv.ID = 42
					return srv, nil
				},
				AllF: func(context.Context) ([]cloudhub.Server, error) {
					return nil, nil
				},
				DeleteF: func(context.Context, cloudhub.Server) error { return nil },
				GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
					if id == 0 {
						return cloudhub.Server{ID: 0, URL: "http://influx.example"}, nil
					}
					return cloudhub.Server{}, errors.New("not found")
				},
				UpdateF: func(context.Context, cloudhub.Server) error { return nil },
			},
		},
		Logger: logger,
		AlertKapacitors: &fakeAlertKapacitorStore{
			addFunc: func(ctx context.Context, k cloudhub.AlertKapacitor) (cloudhub.AlertKapacitor, error) {
				synced = append(synced, k)
				k.ID = "alert-kapa-1"
				return k, nil
			},
		},
		AlertKapacitorMappings: &fakeAlertKapacitorMappingStore{
			putFunc: func(ctx context.Context, sourceID, legacyKapacitorID int, alertKapacitorID string) error {
				mappingSaved = sourceID == 1 && legacyKapacitorID == 42 && alertKapacitorID == "alert-kapa-1"
				return nil
			},
		},
	}

	body := bytes.NewBufferString(`{"name":"kap-1","url":"http://kapacitor.example:9092","username":"user","password":"pw","insecureSkipVerify":true,"active":true}`)
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/sources/1/kapacitors", body)
	req = WithContext(context.Background(), req, map[string]string{"id": "1"})
	rr := httptest.NewRecorder()

	svc.NewKapacitor(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusCreated)
	}
	if len(synced) != 1 {
		t.Fatalf("expected alert kapacitor sync once, got %d", len(synced))
	}
	if synced[0].OrgID != "org-1" {
		t.Fatalf("orgID = %q, want %q", synced[0].OrgID, "org-1")
	}
	if synced[0].Name != "kap-1" || synced[0].URL != "http://kapacitor.example:9092" {
		t.Fatalf("unexpected synced alert kapacitor: %+v", synced[0])
	}
	if !mappingSaved {
		t.Fatal("expected legacy-to-alert kapacitor mapping to be stored")
	}
}

func TestAlertGroupRuleCreateRejectsLegacyNumericKapacitorID(t *testing.T) {
	logger := &mocks.TestLogger{}
	addCalled := false

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				addCalled = true
				r.ID = "rule-1"
				return r, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{},
	}

	reqRule := cloudhub.AlertGroupRule{
		Name:            "cpu high",
		KapacitorID:     "1195174587717230592",
		Database:        "telegraf",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertCondition{
			{Level: "critical", Value: "10", Enabled: true},
		},
		TriggerOperator:  "less",
		TaskType:         "stream",
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
	}
	payload, err := json.Marshal(reqRule)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", bytes.NewReader(payload))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if addCalled {
		t.Fatal("expected alert group rule store Add not to be called for legacy kapacitor ID")
	}
}

func TestAlertGroupRuleUpdateRejectsLegacyNumericKapacitorID(t *testing.T) {
	logger := &mocks.TestLogger{}
	updateCalled := false

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
				return cloudhub.AlertGroupRule{
					ID:              id,
					OrgID:           "org-1",
					KapacitorID:     "existing-uuid",
					Name:            "existing",
					Conditions:      []cloudhub.AlertCondition{{Level: "critical", Value: "90", Enabled: true}},
					Measurement:     "cpu",
					Field:           "usage_idle",
					TaskType:        "stream",
					TriggerOperator: "greater",
				}, nil
			},
			updateFunc: func(context.Context, cloudhub.AlertGroupRule) error {
				updateCalled = true
				return nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{},
	}

	reqRule := cloudhub.AlertGroupRule{
		Name:            "cpu high",
		KapacitorID:     "1195174587717230592",
		Database:        "telegraf",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertCondition{
			{Level: "critical", Value: "10", Enabled: true},
		},
		TriggerOperator:  "less",
		TaskType:         "stream",
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
	}
	payload, err := json.Marshal(reqRule)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v2/alert-group-rules/rule-1", bytes.NewReader(payload))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	req = WithContext(req.Context(), req, map[string]string{"id": "rule-1"})
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleUpdate(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if updateCalled {
		t.Fatal("expected alert group rule store Update not to be called for legacy kapacitor ID")
	}
}

func TestAlertGroupRuleCreateRejectsEnabledConditionWithoutValue(t *testing.T) {
	logger := &mocks.TestLogger{}
	addCalled := false

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				addCalled = true
				r.ID = "rule-1"
				return r, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:    "11111111-1111-1111-1111-111111111111",
					OrgID: "org-1",
				}, nil
			},
		},
	}

	reqRule := cloudhub.AlertGroupRule{
		Name:            "cpu high",
		KapacitorID:     "11111111-1111-1111-1111-111111111111",
		Database:        "telegraf",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertCondition{
			{Level: "critical", Value: "90", Enabled: true},
			{Level: "warning", Value: "", Enabled: true},
		},
		TriggerOperator:  "greater",
		TaskType:         "stream",
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
	}
	payload, err := json.Marshal(reqRule)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", bytes.NewReader(payload))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if addCalled {
		t.Fatal("expected alert group rule store Add not to be called for empty enabled condition value")
	}
}

func TestAlertGroupRuleCreateRejectsDeadmanWithBatchTaskType(t *testing.T) {
	logger := &mocks.TestLogger{}
	addCalled := false

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				addCalled = true
				r.ID = "rule-1"
				return r, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:    "11111111-1111-1111-1111-111111111111",
					OrgID: "org-1",
				}, nil
			},
		},
	}

	reqRule := cloudhub.AlertGroupRule{
		Name:            "cpu deadman",
		KapacitorID:     "11111111-1111-1111-1111-111111111111",
		Database:        "telegraf",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertCondition{
			{Level: "critical", Value: "90", Enabled: true},
		},
		Trigger:          cloudhub.AlertGroupRuleTriggerDeadman,
		TriggerOperator:  "greater",
		TaskType:         cloudhub.AlertGroupRuleTaskTypeBatch,
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
	}
	payload, err := json.Marshal(reqRule)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", bytes.NewReader(payload))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if addCalled {
		t.Fatal("expected alert group rule store Add not to be called for deadman with batch task type")
	}
}

func TestAlertGroupRuleUpdateRejectsEnabledConditionWithoutValue(t *testing.T) {
	logger := &mocks.TestLogger{}
	updateCalled := false

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
				return cloudhub.AlertGroupRule{
					ID:              id,
					OrgID:           "org-1",
					KapacitorID:     "11111111-1111-1111-1111-111111111111",
					Name:            "existing",
					Database:        "telegraf",
					RetentionPolicy: "autogen",
					Measurement:     "cpu",
					Field:           "usage_idle",
					Conditions:      []cloudhub.AlertCondition{{Level: "critical", Value: "90", Enabled: true}},
					TaskType:        "stream",
					TriggerOperator: "greater",
				}, nil
			},
			updateFunc: func(context.Context, cloudhub.AlertGroupRule) error {
				updateCalled = true
				return nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:    "11111111-1111-1111-1111-111111111111",
					OrgID: "org-1",
				}, nil
			},
		},
	}

	reqRule := cloudhub.AlertGroupRule{
		Name:            "cpu high",
		KapacitorID:     "11111111-1111-1111-1111-111111111111",
		Database:        "telegraf",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertCondition{
			{Level: "critical", Value: "90", Enabled: true},
			{Level: "warning", Value: "", Enabled: true},
		},
		TriggerOperator:  "greater",
		TaskType:         "stream",
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
	}
	payload, err := json.Marshal(reqRule)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v2/alert-group-rules/rule-1", bytes.NewReader(payload))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	req = WithContext(req.Context(), req, map[string]string{"id": "rule-1"})
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleUpdate(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if updateCalled {
		t.Fatal("expected alert group rule store Update not to be called for empty enabled condition value")
	}
}

func TestUpdateKapacitorAlsoUpdatesAlertKapacitor(t *testing.T) {
	logger := &mocks.TestLogger{}
	var updated cloudhub.AlertKapacitor

	svc := &Service{
		Store: &mocks.Store{
			ServersStore: &mocks.ServersStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
					return cloudhub.Server{
						ID:                 id,
						SrcID:              1,
						Name:               "old-name",
						URL:                "http://old.example",
						Username:           "old-user",
						Password:           "old-pw",
						InsecureSkipVerify: false,
					}, nil
				},
				UpdateF: func(context.Context, cloudhub.Server) error { return nil },
				AllF:    func(context.Context) ([]cloudhub.Server, error) { return nil, nil },
				AddF:    func(context.Context, cloudhub.Server) (cloudhub.Server, error) { return cloudhub.Server{}, nil },
				DeleteF: func(context.Context, cloudhub.Server) error { return nil },
			},
			SourcesStore: &mocks.SourcesStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Source, error) {
					return cloudhub.Source{ID: 0, URL: "http://influx.example"}, nil
				},
				AllF:    func(context.Context) ([]cloudhub.Source, error) { return nil, nil },
				AddF:    func(context.Context, cloudhub.Source) (cloudhub.Source, error) { return cloudhub.Source{}, nil },
				DeleteF: func(context.Context, cloudhub.Source) error { return nil },
				UpdateF: func(context.Context, cloudhub.Source) error { return nil },
			},
		},
		Logger: logger,
		AlertKapacitors: &fakeAlertKapacitorStore{
			updateFunc: func(ctx context.Context, k cloudhub.AlertKapacitor) error {
				updated = k
				return nil
			},
		},
		AlertKapacitorMappings: &fakeAlertKapacitorMappingStore{
			getFunc: func(context.Context, int, int) (string, error) {
				return "alert-kapa-1", nil
			},
		},
	}

	body := bytes.NewBufferString(`{"name":"new-name","url":"http://new.example","username":"new-user","password":"new-pw","insecureSkipVerify":true}`)
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v1/sources/1/kapacitors/42", body)
	req = WithContext(context.Background(), req, map[string]string{"id": "1", "kid": "42"})
	rr := httptest.NewRecorder()

	svc.UpdateKapacitor(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
	if updated.ID != "alert-kapa-1" {
		t.Fatalf("updated alert kapacitor ID = %q, want %q", updated.ID, "alert-kapa-1")
	}
	if updated.Name != "new-name" || updated.URL != "http://new.example" {
		t.Fatalf("unexpected alert kapacitor update payload: %+v", updated)
	}
}

func TestRemoveKapacitorAlsoDeletesAlertKapacitorAndMapping(t *testing.T) {
	logger := &mocks.TestLogger{}
	deletedAlertID := ""
	mappingDeleted := false

	svc := &Service{
		Store: &mocks.Store{
			ServersStore: &mocks.ServersStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
					return cloudhub.Server{
						ID:    id,
						SrcID: 1,
						Name:  "kap-1",
					}, nil
				},
				DeleteF: func(context.Context, cloudhub.Server) error { return nil },
				AllF:    func(context.Context) ([]cloudhub.Server, error) { return nil, nil },
				AddF:    func(context.Context, cloudhub.Server) (cloudhub.Server, error) { return cloudhub.Server{}, nil },
				UpdateF: func(context.Context, cloudhub.Server) error { return nil },
			},
			SourcesStore: &mocks.SourcesStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Source, error) {
					return cloudhub.Source{ID: 0, URL: "http://influx.example"}, nil
				},
				AllF:    func(context.Context) ([]cloudhub.Source, error) { return nil, nil },
				AddF:    func(context.Context, cloudhub.Source) (cloudhub.Source, error) { return cloudhub.Source{}, nil },
				DeleteF: func(context.Context, cloudhub.Source) error { return nil },
				UpdateF: func(context.Context, cloudhub.Source) error { return nil },
			},
		},
		Logger: logger,
		AlertKapacitors: &fakeAlertKapacitorStore{
			deleteFunc: func(ctx context.Context, id string) error {
				deletedAlertID = id
				return nil
			},
		},
		AlertKapacitorMappings: &fakeAlertKapacitorMappingStore{
			getFunc: func(context.Context, int, int) (string, error) {
				return "alert-kapa-1", nil
			},
			deleteFunc: func(context.Context, int, int) error {
				mappingDeleted = true
				return nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodDelete, "/cloudhub/v1/sources/1/kapacitors/42", nil)
	req = WithContext(context.Background(), req, map[string]string{"id": "1", "kid": "42"})
	rr := httptest.NewRecorder()

	svc.RemoveKapacitor(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusNoContent)
	}
	if deletedAlertID != "alert-kapa-1" {
		t.Fatalf("deleted alert kapacitor ID = %q, want %q", deletedAlertID, "alert-kapa-1")
	}
	if !mappingDeleted {
		t.Fatal("expected alert kapacitor mapping to be deleted")
	}
}

func TestAlertKapacitorsGetBackfillsLegacyKapacitors(t *testing.T) {
	logger := &mocks.TestLogger{}
	alertKapacitors := []cloudhub.AlertKapacitor{}

	svc := &Service{
		Store: &mocks.Store{
			ServersStore: &mocks.ServersStore{
				AllF: func(context.Context) ([]cloudhub.Server, error) {
					return []cloudhub.Server{
						{
							ID:           42,
							SrcID:        1,
							Name:         "kap-1",
							URL:          "http://kapacitor.example:9092",
							Organization: "org-1",
						},
						{
							ID:           99,
							SrcID:        2,
							Name:         "other-org",
							URL:          "http://other.example:9092",
							Organization: "org-2",
						},
					}, nil
				},
				AddF:    func(context.Context, cloudhub.Server) (cloudhub.Server, error) { return cloudhub.Server{}, nil },
				DeleteF: func(context.Context, cloudhub.Server) error { return nil },
				GetF:    func(context.Context, int) (cloudhub.Server, error) { return cloudhub.Server{}, nil },
				UpdateF: func(context.Context, cloudhub.Server) error { return nil },
			},
		},
		Logger: logger,
		AlertKapacitors: &fakeAlertKapacitorStore{
			allFunc: func(ctx context.Context, orgID string) ([]cloudhub.AlertKapacitor, error) {
				var filtered []cloudhub.AlertKapacitor
				for _, k := range alertKapacitors {
					if k.OrgID == orgID {
						filtered = append(filtered, k)
					}
				}
				return filtered, nil
			},
			addFunc: func(ctx context.Context, k cloudhub.AlertKapacitor) (cloudhub.AlertKapacitor, error) {
				k.ID = "alert-kapa-1"
				alertKapacitors = append(alertKapacitors, k)
				return k, nil
			},
		},
		AlertKapacitorMappings: &fakeAlertKapacitorMappingStore{
			getFunc: func(context.Context, int, int) (string, error) {
				return "", errors.New("not found")
			},
			putFunc: func(context.Context, int, int, string) error {
				return nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/cloudhub/v2/alert-kapacitors", nil)
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertKapacitorsGet(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if len(alertKapacitors) != 1 {
		t.Fatalf("expected one legacy kapacitor to be backfilled, got %d", len(alertKapacitors))
	}
	if alertKapacitors[0].Name != "kap-1" || alertKapacitors[0].OrgID != "org-1" {
		t.Fatalf("unexpected backfilled alert kapacitor: %+v", alertKapacitors[0])
	}
}

func TestSyncKapacitorTaskLogsCreateFailureContext(t *testing.T) {
	logger := &mocks.TestLogger{}
	kapacitorAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPatch {
			http.Error(w, "boom", http.StatusInternalServerError)
			return
		}
		http.Error(w, "unexpected", http.StatusBadRequest)
	}))
	defer kapacitorAPI.Close()

	svc := &Service{
		Logger: logger,
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:  "kap-1",
					URL: kapacitorAPI.URL,
				}, nil
			},
		},
	}

	err := svc.syncKapacitorTask(context.Background(), cloudhub.AlertGroupRule{
		ID:               "rule-1",
		KapacitorID:      "kap-1",
		Active:           true,
		Database:         "Default",
		RetentionPolicy:  "autogen",
		Measurement:      "cpu",
		Field:            "usage_idle",
		TriggerOperator:  "greater",
		TaskType:         "stream",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Conditions: []cloudhub.AlertCondition{
			{Level: "critical", Value: "90", Enabled: true},
		},
	}, kapackage.AlertRecipients{})
	if err == nil {
		t.Fatal("expected syncKapacitorTask error")
	}

	if !logger.HasMessage("info", "alert-group sync start task=alert-group-rule-1 rule=rule-1 kapacitor=kap-1 active=true db=Default rp=autogen recipients=0/0/0 hosts=0") {
		t.Fatalf("expected sync start log, got %#v", logger.Messages)
	}
	if !logger.HasMessage("error", "alert-group sync patch failed task=alert-group-rule-1 error=kapacitor patch task 500: boom\n") {
		t.Fatalf("expected sync failure log, got %#v", logger.Messages)
	}
}

func TestAlertGroupRuleCreateReturnsInternalServerErrorWhenTaskSyncFails(t *testing.T) {
	logger := &mocks.TestLogger{}
	kapacitorAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPatch {
			http.Error(w, "kapacitor task failed", http.StatusInternalServerError)
			return
		}
		http.Error(w, "unexpected", http.StatusBadRequest)
	}))
	defer kapacitorAPI.Close()

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				r.ID = "rule-1"
				return r, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:    "11111111-1111-1111-1111-111111111111",
					OrgID: "org-1",
					URL:   kapacitorAPI.URL,
				}, nil
			},
		},
	}

	payload := bytes.NewBufferString(`{"name":"cpu high","kapacitorId":"11111111-1111-1111-1111-111111111111","database":"Default","retentionPolicy":"autogen","measurement":"cpu","field":"usage_idle","conditions":[{"level":"critical","value":"90","enabled":true}],"triggerOperator":"greater","taskType":"stream","every":"30s","occurrenceType":"consecutive","occurrenceCount":1,"occurrenceWindow":"5m","active":true}`)
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", payload)
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusInternalServerError, rr.Body.String())
	}
}

func TestAlertGroupRuleUpdateReturnsInternalServerErrorWhenTaskSyncFails(t *testing.T) {
	logger := &mocks.TestLogger{}
	kapacitorAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPatch {
			http.Error(w, "kapacitor task failed", http.StatusInternalServerError)
			return
		}
		http.Error(w, "unexpected", http.StatusBadRequest)
	}))
	defer kapacitorAPI.Close()

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
				return cloudhub.AlertGroupRule{
					ID:          id,
					OrgID:       "org-1",
					KapacitorID: "11111111-1111-1111-1111-111111111111",
				}, nil
			},
			updateFunc: func(context.Context, cloudhub.AlertGroupRule) error { return nil },
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:    "11111111-1111-1111-1111-111111111111",
					OrgID: "org-1",
					URL:   kapacitorAPI.URL,
				}, nil
			},
		},
	}

	payload := bytes.NewBufferString(`{"name":"cpu high","kapacitorId":"11111111-1111-1111-1111-111111111111","database":"Default","retentionPolicy":"autogen","measurement":"cpu","field":"usage_idle","conditions":[{"level":"critical","value":"90","enabled":true}],"triggerOperator":"greater","taskType":"stream","every":"30s","occurrenceType":"consecutive","occurrenceCount":1,"occurrenceWindow":"5m","active":true}`)
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v2/alert-group-rules/rule-1", payload)
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	req = WithContext(req.Context(), req, map[string]string{"id": "rule-1"})
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleUpdate(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusInternalServerError, rr.Body.String())
	}
}

func TestAlertGroupRuleUpdateAppliesPartialPatchOnExisting(t *testing.T) {
	logger := &mocks.TestLogger{}
	kapacitorAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer kapacitorAPI.Close()

	existing := cloudhub.AlertGroupRule{
		ID:               "rule-1",
		OrgID:            "org-1",
		KapacitorID:      "11111111-1111-1111-1111-111111111111",
		Name:             "cpu high",
		Database:         "telegraf",
		RetentionPolicy:  "autogen",
		Measurement:      "cpu",
		Field:            "usage_idle",
		Conditions:       []cloudhub.AlertCondition{{Level: "critical", Value: "90", Enabled: true}},
		TriggerOperator:  "greater",
		Trigger:          "threshold",
		TaskType:         "stream",
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
		Hostnames:        []string{"web-1"},
		UserGroupIDs:     []string{"ug-1"},
		Recipients:       []string{"old@example.com"},
	}

	var captured cloudhub.AlertGroupRule
	var setHostsCalled, setUserGroupsCalled bool

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
				return existing, nil
			},
			updateFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) error {
				captured = r
				return nil
			},
			setHostsFunc: func(ctx context.Context, ruleID string, hostnames []string) error {
				setHostsCalled = true
				if len(hostnames) != 1 || hostnames[0] != "web-1" {
					t.Errorf("SetHosts: want [web-1], got %v", hostnames)
				}
				return nil
			},
			setUserGroupsFunc: func(ctx context.Context, ruleID string, userGroupIDs []string) error {
				setUserGroupsCalled = true
				if len(userGroupIDs) != 1 || userGroupIDs[0] != "ug-1" {
					t.Errorf("SetUserGroups: want [ug-1], got %v", userGroupIDs)
				}
				return nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:    "11111111-1111-1111-1111-111111111111",
					OrgID: "org-1",
					URL:   kapacitorAPI.URL,
				}, nil
			},
		},
	}

	payload := bytes.NewBufferString(`{"recipients":["new@example.com"]}`)
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v2/alert-group-rules/rule-1", payload)
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	req = WithContext(req.Context(), req, map[string]string{"id": "rule-1"})
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleUpdate(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rr.Code, rr.Body.String())
	}
	if captured.Name != "cpu high" {
		t.Errorf("Name overwritten: %q", captured.Name)
	}
	if captured.Database != "telegraf" {
		t.Errorf("Database overwritten: %q", captured.Database)
	}
	if captured.Measurement != "cpu" {
		t.Errorf("Measurement overwritten: %q", captured.Measurement)
	}
	if captured.Field != "usage_idle" {
		t.Errorf("Field overwritten: %q", captured.Field)
	}
	if len(captured.Conditions) != 1 || captured.Conditions[0].Value != "90" {
		t.Errorf("Conditions overwritten: %+v", captured.Conditions)
	}
	if captured.TriggerOperator != "greater" {
		t.Errorf("TriggerOperator overwritten: %q", captured.TriggerOperator)
	}
	if !captured.Active {
		t.Errorf("Active overwritten to false")
	}
	if len(captured.Recipients) != 1 || captured.Recipients[0] != "new@example.com" {
		t.Errorf("Recipients not updated: %v", captured.Recipients)
	}
	if !setHostsCalled || !setUserGroupsCalled {
		t.Errorf("SetHosts/SetUserGroups not called: hosts=%v userGroups=%v", setHostsCalled, setUserGroupsCalled)
	}
}

func TestAlertGroupRuleTestNotificationUsesSavedRuleRecipients(t *testing.T) {
	logger := &mocks.TestLogger{}
	var sentKapaURL string
	var sentRecipients []string
	var sentSubject, sentBody string
	prev := kapacitorSMTPSender
	kapacitorSMTPSender = func(_ context.Context, kapaURL string, to []string, subject, body string) error {
		sentKapaURL = kapaURL
		sentRecipients = append([]string(nil), to...)
		sentSubject = subject
		sentBody = body
		return nil
	}
	defer func() { kapacitorSMTPSender = prev }()

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			getFunc: func(context.Context, string) (cloudhub.AlertGroupRule, error) {
				return cloudhub.AlertGroupRule{
					ID:          "rule-1",
					OrgID:       "org-1",
					KapacitorID: "kapa-1",
				}, nil
			},
			userGroupsByRuleFunc: func(context.Context, string) ([]cloudhub.UserGroup, error) {
				return []cloudhub.UserGroup{
					{
						ID:    "group-1",
						OrgID: "org-1",
						Members: []cloudhub.UserGroupMember{
							{
								UserID:       "user-1",
								UserName:     "jin",
								Email:        "jin@example.com",
								EmailEnabled: true,
								EmailLevel:   "critical",
							},
						},
						AlertNodes: cloudhub.AlertNodes{
							Email: []*cloudhub.Email{{To: []string{"ops@example.com"}}},
						},
					},
				}, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{
					ID:    "kapa-1",
					OrgID: "org-1",
					URL:   "http://kapacitor.example.com:9094",
				}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules-test-notification/rule-1", bytes.NewBufferString(`{"title":"테스트 제목","message":"테스트 메시지"}`))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	req = WithContext(req.Context(), req, map[string]string{"id": "rule-1"})
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotificationByID(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	if sentKapaURL != "http://kapacitor.example.com:9094" {
		t.Fatalf("kapaURL = %q", sentKapaURL)
	}
	if len(sentRecipients) != 2 {
		t.Fatalf("unexpected recipients: %#v", sentRecipients)
	}
	if sentSubject != "테스트 제목" {
		t.Fatalf("subject = %#v, want %q", sentSubject, "테스트 제목")
	}
	if sentBody != "테스트 메시지" {
		t.Fatalf("body = %#v, want %q", sentBody, "테스트 메시지")
	}
}

func TestAlertGroupRuleTestNotificationUsesDraftRecipients(t *testing.T) {
	logger := &mocks.TestLogger{}
	var sentRecipients []string
	var sentSubject, sentBody string
	prev := kapacitorSMTPSender
	kapacitorSMTPSender = func(_ context.Context, _ string, to []string, subject, body string) error {
		sentRecipients = append([]string(nil), to...)
		sentSubject = subject
		sentBody = body
		return nil
	}
	defer func() { kapacitorSMTPSender = prev }()

	group := cloudhub.UserGroup{
		ID:    "group-1",
		OrgID: "org-1",
		Members: []cloudhub.UserGroupMember{
			{
				UserID:       "user-1",
				UserName:     "jin",
				Email:        "jin@example.com",
				EmailEnabled: true,
				EmailLevel:   "warning",
			},
		},
	}

	svc := &Service{
		Logger: logger,
		UserGroups: &fakeUserGroupStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.UserGroup, error) {
				switch id {
				case "group-1":
					return group, nil
				case "group-2":
					return cloudhub.UserGroup{ID: "group-2", OrgID: "org-2"}, nil
				default:
					return cloudhub.UserGroup{}, errors.New("not found")
				}
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapacitor.example.com:9094"}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(`{"kapacitorId":"kapa-1","userGroupIds":["group-1","group-2"],"title":"임시 제목","message":"임시 메시지"}`))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	if len(sentRecipients) != 1 {
		t.Fatalf("unexpected recipients: %#v", sentRecipients)
	}
	if sentSubject != "임시 제목" {
		t.Fatalf("subject = %#v, want %q", sentSubject, "임시 제목")
	}
	if sentBody != "임시 메시지" {
		t.Fatalf("body = %#v, want %q", sentBody, "임시 메시지")
	}
}

func TestAlertGroupRuleTestNotificationUsesManualRecipientsOverride(t *testing.T) {
	logger := &mocks.TestLogger{}
	var sentRecipients []string
	prev := kapacitorSMTPSender
	kapacitorSMTPSender = func(_ context.Context, _ string, to []string, _, _ string) error {
		sentRecipients = append([]string(nil), to...)
		return nil
	}
	defer func() { kapacitorSMTPSender = prev }()

	svc := &Service{
		Logger: logger,
		UserGroups: &fakeUserGroupStore{
			allFunc: func(context.Context, string) ([]cloudhub.UserGroup, error) {
				return []cloudhub.UserGroup{
					{
						ID:    "group-1",
						OrgID: "org-1",
						Members: []cloudhub.UserGroupMember{
							{
								UserID:       "user-1",
								UserName:     "jin",
								Email:        "jinhyeong.kim@snetsystems.co.kr",
								EmailEnabled: true,
							},
						},
					},
				}, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapa"}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(`{"kapacitorId":"kapa-1","title":"임시 제목","message":"임시 메시지","recipients":["override@example.com"]}`))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	if len(sentRecipients) != 1 || sentRecipients[0] != "override@example.com" {
		t.Fatalf("unexpected recipients: %#v", sentRecipients)
	}
}

func TestAlertGroupRuleTestNotificationMergesManualAndUserGroupRecipients(t *testing.T) {
	logger := &mocks.TestLogger{}
	var sentRecipients []string
	prev := kapacitorSMTPSender
	kapacitorSMTPSender = func(_ context.Context, _ string, to []string, _, _ string) error {
		sentRecipients = append([]string(nil), to...)
		return nil
	}
	defer func() { kapacitorSMTPSender = prev }()

	svc := &Service{
		Logger: logger,
		UserGroups: &fakeUserGroupStore{
			getFunc: func(_ context.Context, id string) (cloudhub.UserGroup, error) {
				if id != "group-1" {
					return cloudhub.UserGroup{}, errors.New("not found")
				}
				return cloudhub.UserGroup{
					ID:    "group-1",
					OrgID: "org-1",
					Members: []cloudhub.UserGroupMember{{
						UserID: "u1", Email: "jin@example.com", EmailEnabled: true,
					}},
				}, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapa"}, nil
			},
		},
	}

	body := `{"kapacitorId":"kapa-1","userGroupIds":["group-1"],"title":"t","message":"m","recipients":["manual@example.com","jin@example.com"]}`
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(body))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	// Manual + tag-resolved member → 2 unique recipients (jin@ deduped).
	if len(sentRecipients) != 2 {
		t.Fatalf("unexpected recipients: %#v", sentRecipients)
	}
	seen := map[string]bool{}
	for _, r := range sentRecipients {
		seen[r] = true
	}
	if !seen["manual@example.com"] || !seen["jin@example.com"] {
		t.Fatalf("missing recipients: %#v", sentRecipients)
	}
}

func TestAlertGroupRuleTestNotificationFallsBackToLoggedInUser(t *testing.T) {
	logger := &mocks.TestLogger{}
	var sentRecipients []string
	prev := kapacitorSMTPSender
	kapacitorSMTPSender = func(_ context.Context, _ string, to []string, _, _ string) error {
		sentRecipients = append([]string(nil), to...)
		return nil
	}
	defer func() { kapacitorSMTPSender = prev }()

	svc := &Service{
		Logger:     logger,
		UserGroups: &fakeUserGroupStore{},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapa"}, nil
			},
		},
	}

	body := `{"kapacitorId":"kapa-1","title":"t","message":"m"}`
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{Name: "jin", Email: "session@example.com"})
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if len(sentRecipients) != 1 || sentRecipients[0] != "session@example.com" {
		t.Fatalf("unexpected recipients: %#v", sentRecipients)
	}
}

func TestAlertGroupRuleTestNotificationLogsKapacitorAndRecipientsOnFailure(t *testing.T) {
	logger := &mocks.TestLogger{}
	prev := kapacitorSMTPSender
	kapacitorSMTPSender = func(_ context.Context, _ string, _ []string, _ string, _ string) error {
		return errors.New("smtp send failed")
	}
	defer func() { kapacitorSMTPSender = prev }()

	svc := &Service{
		Logger: logger,
		UserGroups: &fakeUserGroupStore{
			allFunc: func(context.Context, string) ([]cloudhub.UserGroup, error) {
				return []cloudhub.UserGroup{
					{
						ID:    "group-1",
						OrgID: "org-1",
						Members: []cloudhub.UserGroupMember{
							{
								UserID:       "user-1",
								UserName:     "jin",
								Email:        "jinhyeong.kim@snetsystems.co.kr",
								EmailEnabled: true,
							},
						},
					},
				}, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapacitor.example.com:9094"}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(`{"kapacitorId":"kapa-1","title":"임시 제목","message":"임시 메시지","recipients":["override@example.com"]}`))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if !logger.HasMessage("info", "alert-group test send start org_id=org-1 kapacitor_url=http://kapacitor.example.com:9094 recipients=override@example.com title=임시 제목") {
		t.Fatalf("expected start log, got %#v", logger.Messages)
	}
	if !logger.HasMessage("error", "alert-group test send failed org_id=org-1 kapacitor_url=http://kapacitor.example.com:9094 recipients=override@example.com error=smtp send failed") {
		t.Fatalf("expected failure log, got %#v", logger.Messages)
	}
}

func TestCreateKapacitorTaskTrimsTrailingSlash(t *testing.T) {
	var requestedPath string
	kapacitorAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer kapacitorAPI.Close()

	err := createKapacitorTask(kapacitorAPI.URL+"/", "alert-group-rule-1", "stream|from()", "Default", "autogen")
	if err != nil {
		t.Fatalf("unexpected create error: %v", err)
	}
	if requestedPath != "/kapacitor/v1/tasks" {
		t.Fatalf("path = %q, want %q", requestedPath, "/kapacitor/v1/tasks")
	}
}
