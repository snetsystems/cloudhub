package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
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
	allFunc                      func(context.Context, string) ([]cloudhub.AlertGroupRule, error)
	addFunc                      func(context.Context, cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error)
	updateFunc                   func(context.Context, cloudhub.AlertGroupRule) error
	getFunc                      func(context.Context, string) (cloudhub.AlertGroupRule, error)
	setHostsFunc                 func(context.Context, string, []string) error
	hostnamesFunc                func(context.Context, string) ([]string, error)
	setEventHandlersFunc         func(context.Context, string, []cloudhub.AlertRuleEventHandler) error
	eventHandlersByRuleFunc      func(context.Context, string) ([]cloudhub.AlertRuleEventHandler, error)
	recipientGroupsByHandlerFunc func(context.Context, string) ([]cloudhub.RecipientGroup, error)
	setRecipientGroupsFunc       func(context.Context, string, []string) error
	recipientGroupsByRuleFunc    func(context.Context, string) ([]cloudhub.RecipientGroup, error)
	rulesByRecipientGroupFunc    func(context.Context, string) ([]cloudhub.AlertGroupRule, error)
	conditionsByRuleFunc         func(context.Context, string) ([]cloudhub.AlertRuleCondition, error)
	setConditionsFunc            func(context.Context, string, []cloudhub.AlertRuleCondition) error
	deleteFunc                   func(context.Context, string) error
}

func (f *fakeAlertGroupRuleStore) All(ctx context.Context, orgID string) ([]cloudhub.AlertGroupRule, error) {
	if f.allFunc != nil {
		return f.allFunc(ctx, orgID)
	}
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
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, id)
	}
	return nil
}

func (f *fakeAlertGroupRuleStore) SetHosts(ctx context.Context, ruleID string, hostnames []string) error {
	if f.setHostsFunc != nil {
		return f.setHostsFunc(ctx, ruleID, hostnames)
	}
	return nil
}

func (f *fakeAlertGroupRuleStore) Hostnames(ctx context.Context, ruleID string) ([]string, error) {
	if f.hostnamesFunc != nil {
		return f.hostnamesFunc(ctx, ruleID)
	}
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) SetEventHandlers(ctx context.Context, ruleID string, handlers []cloudhub.AlertRuleEventHandler) error {
	if f.setEventHandlersFunc != nil {
		return f.setEventHandlersFunc(ctx, ruleID, handlers)
	}
	return nil
}

func (f *fakeAlertGroupRuleStore) EventHandlersByRule(ctx context.Context, ruleID string) ([]cloudhub.AlertRuleEventHandler, error) {
	if f.eventHandlersByRuleFunc != nil {
		return f.eventHandlersByRuleFunc(ctx, ruleID)
	}
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) RecipientGroupsByEventHandler(ctx context.Context, handlerID string) ([]cloudhub.RecipientGroup, error) {
	if f.recipientGroupsByHandlerFunc != nil {
		return f.recipientGroupsByHandlerFunc(ctx, handlerID)
	}
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) SetRecipientGroups(ctx context.Context, ruleID string, recipientGroupIDs []string) error {
	if f.setRecipientGroupsFunc != nil {
		return f.setRecipientGroupsFunc(ctx, ruleID, recipientGroupIDs)
	}
	return nil
}

func (f *fakeAlertGroupRuleStore) RecipientGroupsByRule(ctx context.Context, ruleID string) ([]cloudhub.RecipientGroup, error) {
	if f.recipientGroupsByRuleFunc != nil {
		return f.recipientGroupsByRuleFunc(ctx, ruleID)
	}
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) RulesByRecipientGroup(ctx context.Context, recipientGroupID string) ([]cloudhub.AlertGroupRule, error) {
	if f.rulesByRecipientGroupFunc != nil {
		return f.rulesByRecipientGroupFunc(ctx, recipientGroupID)
	}
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) ConditionsByRule(ctx context.Context, ruleID string) ([]cloudhub.AlertRuleCondition, error) {
	if f.conditionsByRuleFunc != nil {
		return f.conditionsByRuleFunc(ctx, ruleID)
	}
	return nil, nil
}

func (f *fakeAlertGroupRuleStore) SetConditions(ctx context.Context, ruleID string, conditions []cloudhub.AlertRuleCondition) error {
	if f.setConditionsFunc != nil {
		return f.setConditionsFunc(ctx, ruleID, conditions)
	}
	return nil
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

type fakeRecipientGroupStore struct {
	allFunc             func(context.Context, string) ([]cloudhub.RecipientGroup, error)
	getFunc             func(context.Context, string) (cloudhub.RecipientGroup, error)
	addFunc             func(context.Context, cloudhub.RecipientGroup) (cloudhub.RecipientGroup, error)
	updateFunc          func(context.Context, cloudhub.RecipientGroup) error
	deleteFunc          func(context.Context, string) error
	addMemberFunc       func(context.Context, cloudhub.RecipientGroupMember) (cloudhub.RecipientGroupMember, error)
	updateMemberFunc    func(context.Context, cloudhub.RecipientGroupMember) error
	deleteMemberFunc    func(context.Context, string) error
	membersFunc         func(context.Context, string) ([]cloudhub.RecipientGroupMember, error)
	membersByUserIDFunc func(context.Context, string, string) ([]cloudhub.RecipientGroupMember, error)
}

func (f *fakeRecipientGroupStore) All(ctx context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
	if f.allFunc != nil {
		return f.allFunc(ctx, orgID)
	}
	return nil, nil
}

func (f *fakeRecipientGroupStore) Get(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, id)
	}
	return cloudhub.RecipientGroup{}, errors.New("not found")
}

func (f *fakeRecipientGroupStore) Add(ctx context.Context, g cloudhub.RecipientGroup) (cloudhub.RecipientGroup, error) {
	if f.addFunc != nil {
		return f.addFunc(ctx, g)
	}
	return g, nil
}

func (f *fakeRecipientGroupStore) Update(ctx context.Context, g cloudhub.RecipientGroup) error {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, g)
	}
	return nil
}

func (f *fakeRecipientGroupStore) MarkAsDefault(ctx context.Context, orgID, groupID string) error {
	return nil
}

func (f *fakeRecipientGroupStore) Delete(ctx context.Context, id string) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, id)
	}
	return nil
}

func (f *fakeRecipientGroupStore) AddMember(ctx context.Context, m cloudhub.RecipientGroupMember) (cloudhub.RecipientGroupMember, error) {
	if f.addMemberFunc != nil {
		return f.addMemberFunc(ctx, m)
	}
	return m, nil
}

func (f *fakeRecipientGroupStore) UpdateMember(ctx context.Context, m cloudhub.RecipientGroupMember) error {
	if f.updateMemberFunc != nil {
		return f.updateMemberFunc(ctx, m)
	}
	return nil
}

func (f *fakeRecipientGroupStore) DeleteMember(ctx context.Context, memberID string) error {
	if f.deleteMemberFunc != nil {
		return f.deleteMemberFunc(ctx, memberID)
	}
	return nil
}

func (f *fakeRecipientGroupStore) Members(ctx context.Context, groupID string) ([]cloudhub.RecipientGroupMember, error) {
	if f.membersFunc != nil {
		return f.membersFunc(ctx, groupID)
	}
	return nil, nil
}

func (f *fakeRecipientGroupStore) MembersByUserID(ctx context.Context, orgID, userID string) ([]cloudhub.RecipientGroupMember, error) {
	if f.membersByUserIDFunc != nil {
		return f.membersByUserIDFunc(ctx, orgID, userID)
	}
	return nil, nil
}

// fakeAlertRecipientMemberPrefsStore returns EmailEnabled+EmailLevel=all by default
// for any member, simulating the new prefs-based recipient resolution.
type fakeAlertRecipientMemberPrefsStore struct {
	getFunc        func(context.Context, string) (cloudhub.AlertRecipientMemberPrefs, error)
	upsertFunc     func(context.Context, cloudhub.AlertRecipientMemberPrefs) error
	upsertBulkFunc func(context.Context, []cloudhub.AlertRecipientMemberPrefs) error
	deleteFunc     func(context.Context, string) error
	byGroupFunc    func(context.Context, string) ([]cloudhub.AlertRecipientMemberPrefs, error)
}

func (f *fakeAlertRecipientMemberPrefsStore) Get(ctx context.Context, memberID string) (cloudhub.AlertRecipientMemberPrefs, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, memberID)
	}
	return cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: memberID,
		EmailEnabled:           true,
		EmailLevel:             "all",
	}, nil
}

func (f *fakeAlertRecipientMemberPrefsStore) Upsert(ctx context.Context, p cloudhub.AlertRecipientMemberPrefs) error {
	if f.upsertFunc != nil {
		return f.upsertFunc(ctx, p)
	}
	return nil
}

func (f *fakeAlertRecipientMemberPrefsStore) UpsertBulk(ctx context.Context, prefs []cloudhub.AlertRecipientMemberPrefs) error {
	if f.upsertBulkFunc != nil {
		return f.upsertBulkFunc(ctx, prefs)
	}
	return nil
}

func (f *fakeAlertRecipientMemberPrefsStore) Delete(ctx context.Context, memberID string) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, memberID)
	}
	return nil
}

func (f *fakeAlertRecipientMemberPrefsStore) ByGroup(ctx context.Context, groupID string) ([]cloudhub.AlertRecipientMemberPrefs, error) {
	if f.byGroupFunc != nil {
		return f.byGroupFunc(ctx, groupID)
	}
	return nil, nil
}

func TestResolveRuleRecipientsNoHandlerReturnsNoRecipients(t *testing.T) {
	allCalled := false
	svc := &Service{
		AlertGroupRules: &fakeAlertGroupRuleStore{
			eventHandlersByRuleFunc: func(context.Context, string) ([]cloudhub.AlertRuleEventHandler, error) {
				return nil, nil
			},
		},
		RecipientGroups: &fakeRecipientGroupStore{
			allFunc: func(_ context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
				allCalled = true
				if orgID != "org-1" {
					t.Fatalf("orgID = %q, want org-1", orgID)
				}
				return []cloudhub.RecipientGroup{{
					ID: "group-all",
					Members: []cloudhub.RecipientGroupMember{{
						ID:    "member-1",
						Email: "all@example.com",
					}},
				}}, nil
			},
		},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
	}

	recipients, err := svc.resolveRuleRecipients(context.Background(), cloudhub.AlertGroupRule{
		ID:    "rule-1",
		OrgID: "org-1",
	})
	if err != nil {
		t.Fatalf("resolveRuleRecipients: %v", err)
	}
	if allCalled {
		t.Fatal("did not expect RecipientGroups.All when rule has no email handler")
	}
	if len(recipients.Crit) != 0 || len(recipients.Warn) != 0 || len(recipients.Info) != 0 {
		t.Fatalf("unexpected recipients: %+v", recipients)
	}
}

func TestResolveRuleRecipientsEmailHandlerWithoutGroupsUsesAllOrgGroups(t *testing.T) {
	allCalled := false
	svc := &Service{
		AlertGroupRules: &fakeAlertGroupRuleStore{
			eventHandlersByRuleFunc: func(context.Context, string) ([]cloudhub.AlertRuleEventHandler, error) {
				return []cloudhub.AlertRuleEventHandler{{
					ID:      "handler-1",
					Type:    cloudhub.AlertRuleEventHandlerEmail,
					Enabled: true,
				}}, nil
			},
		},
		RecipientGroups: &fakeRecipientGroupStore{
			allFunc: func(_ context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
				allCalled = true
				if orgID != "org-1" {
					t.Fatalf("orgID = %q, want org-1", orgID)
				}
				return []cloudhub.RecipientGroup{{
					ID: "group-all",
					Members: []cloudhub.RecipientGroupMember{{
						ID:    "member-1",
						Email: "all@example.com",
					}},
				}}, nil
			},
		},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
	}

	recipients, err := svc.resolveRuleRecipients(context.Background(), cloudhub.AlertGroupRule{
		ID:    "rule-1",
		OrgID: "org-1",
	})
	if err != nil {
		t.Fatalf("resolveRuleRecipients: %v", err)
	}
	if !allCalled {
		t.Fatal("expected RecipientGroups.All for enabled email handler with no groups")
	}
	if len(recipients.Crit) != 1 || recipients.Crit[0] != "all@example.com" {
		t.Fatalf("unexpected recipients: %+v", recipients)
	}
}

func TestResolveDraftAlertGroupRecipientGroupsEmptyMeansAllOrg(t *testing.T) {
	svc := &Service{
		RecipientGroups: &fakeRecipientGroupStore{
			allFunc: func(_ context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
				return []cloudhub.RecipientGroup{
					{ID: "group-1", OrgID: orgID},
					{ID: "group-2", OrgID: orgID},
				}, nil
			},
		},
	}

	groups, err := svc.resolveDraftAlertGroupRecipientGroups(context.Background(), "org-1", nil)
	if err != nil {
		t.Fatalf("resolveDraftAlertGroupRecipientGroups: %v", err)
	}
	if len(groups) != 2 {
		t.Fatalf("groups len = %d, want 2", len(groups))
	}
}

func TestAlertGroupRuleTestNotificationEmptyRecipientGroupIDsUsesAllOrg(t *testing.T) {
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
		RecipientGroups: &fakeRecipientGroupStore{
			allFunc: func(context.Context, string) ([]cloudhub.RecipientGroup, error) {
				return []cloudhub.RecipientGroup{{
					ID:    "group-1",
					OrgID: "org-1",
					Members: []cloudhub.RecipientGroupMember{{
						ID:    "m-1",
						Email: "org-wide@example.com",
					}},
				}}, nil
			},
		},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapacitor.example.com:9094"}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(`{"kapacitorId":"kapa-1","recipientGroupIds":[],"title":"t","message":"m"}`))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if len(sentRecipients) != 1 || sentRecipients[0] != "org-wide@example.com" {
		t.Fatalf("unexpected recipients: %#v", sentRecipients)
	}
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
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "critical", Value: 10, Enabled: true},
		},
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

func TestAlertGroupRuleCreateNormalizesLegacyKapacitorID(t *testing.T) {
	logger := &mocks.TestLogger{}
	const targetUUID = "11111111-1111-1111-1111-111111111111"
	var storedRule cloudhub.AlertGroupRule

	kapacitorAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer kapacitorAPI.Close()

	svc := &Service{
		Logger: logger,
		Store: &mocks.Store{
			ServersStore: &mocks.ServersStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
					if id != 42 {
						return cloudhub.Server{}, errors.New("not found")
					}
					return cloudhub.Server{ID: 42, SrcID: 1}, nil
				},
			},
		},
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				storedRule = r
				r.ID = "rule-1"
				return r, nil
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertKapacitor, error) {
				if id != targetUUID {
					return cloudhub.AlertKapacitor{}, errors.New("not found")
				}
				return cloudhub.AlertKapacitor{ID: id, OrgID: "org-1", URL: kapacitorAPI.URL}, nil
			},
		},
		AlertKapacitorMappings: &fakeAlertKapacitorMappingStore{
			getFunc: func(ctx context.Context, sourceID, legacyKapacitorID int) (string, error) {
				if sourceID != 1 || legacyKapacitorID != 42 {
					return "", errors.New("not found")
				}
				return targetUUID, nil
			},
		},
	}

	reqRule := cloudhub.AlertGroupRule{
		Name:            "cpu high",
		KapacitorID:     "42",
		Database:        "telegraf",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "critical", Value: 90, Enabled: true},
		},
		TaskType:         "stream",
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
	}
	payload, _ := json.Marshal(reqRule)

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", bytes.NewReader(payload))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}
	if storedRule.KapacitorID != targetUUID {
		t.Fatalf("stored KapacitorID = %q, want %q", storedRule.KapacitorID, targetUUID)
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
					ID:          id,
					OrgID:       "org-1",
					KapacitorID: "existing-uuid",
					Name:        "existing",
					Conditions:  []cloudhub.AlertRuleCondition{{Level: "critical", Value: 90, Enabled: true}},
					Measurement: "cpu",
					Field:       "usage_idle",
					TaskType:    "stream",
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
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "critical", Value: 10, Enabled: true},
		},
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

// Dropped TestAlertGroupRuleCreateRejectsEnabledConditionWithoutValue: AlertRuleCondition.Value
// is now float64 — "empty value" is no longer expressible, and the handler no longer rejects it.

// Dropped TestAlertGroupRuleUpdateRejectsEnabledConditionWithoutValue: same reason as above.

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
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "critical", Value: 90, Enabled: true},
		},
		Trigger:          cloudhub.AlertGroupRuleTriggerDeadman,
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

func TestAlertGroupRuleCreateRejectsMissingSourceFields(t *testing.T) {
	tests := []struct {
		name      string
		request   cloudhub.AlertGroupRule
		wantError string
	}{
		{
			name: "database missing",
			request: cloudhub.AlertGroupRule{
				Name:            "cpu high",
				RetentionPolicy: "autogen",
				Measurement:     "cpu",
				Field:           "usage_idle",
			},
			wantError: "database is required",
		},
		{
			name: "retention policy missing",
			request: cloudhub.AlertGroupRule{
				Name:        "cpu high",
				Database:    "telegraf",
				Measurement: "cpu",
				Field:       "usage_idle",
			},
			wantError: "retentionPolicy is required",
		},
		{
			name: "measurement missing",
			request: cloudhub.AlertGroupRule{
				Name:            "cpu high",
				Database:        "telegraf",
				RetentionPolicy: "autogen",
				Field:           "usage_idle",
			},
			wantError: "measurement is required",
		},
		{
			name: "field missing",
			request: cloudhub.AlertGroupRule{
				Name:            "cpu high",
				Database:        "telegraf",
				RetentionPolicy: "autogen",
				Measurement:     "cpu",
			},
			wantError: "field is required",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
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
			}

			reqRule := tt.request
			reqRule.Conditions = []cloudhub.AlertRuleCondition{
				{Level: "critical", Value: 90, Operator: "greater", Enabled: true},
			}
			reqRule.Trigger = cloudhub.AlertGroupRuleTriggerThreshold
			reqRule.TaskType = cloudhub.AlertGroupRuleTaskTypeStream
			reqRule.Every = "30s"
			reqRule.OccurrenceType = "consecutive"
			reqRule.OccurrenceCount = 1
			reqRule.OccurrenceWindow = "5m"
			reqRule.Active = true
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
			if !strings.Contains(rr.Body.String(), tt.wantError) {
				t.Fatalf("body should mention %q: %s", tt.wantError, rr.Body.String())
			}
			if addCalled {
				t.Fatal("expected alert group rule store Add not to be called")
			}
		})
	}
}

func TestAlertGroupRuleCreateAcceptsUIRelativePayload(t *testing.T) {
	logger := &mocks.TestLogger{}

	var added cloudhub.AlertGroupRule
	var setHosts []string
	var setEventHandlers []cloudhub.AlertRuleEventHandler
	var setConditions []cloudhub.AlertRuleCondition

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				added = r
				r.ID = "rule-1"
				return r, nil
			},
			setHostsFunc: func(ctx context.Context, ruleID string, hostnames []string) error {
				setHosts = append([]string(nil), hostnames...)
				return nil
			},
			setEventHandlersFunc: func(ctx context.Context, ruleID string, handlers []cloudhub.AlertRuleEventHandler) error {
				setEventHandlers = append([]cloudhub.AlertRuleEventHandler(nil), handlers...)
				return nil
			},
			setConditionsFunc: func(ctx context.Context, ruleID string, conditions []cloudhub.AlertRuleCondition) error {
				setConditions = append([]cloudhub.AlertRuleCondition(nil), conditions...)
				return nil
			},
		},
		// No event handler means no external notification recipients.
		RecipientGroups: &fakeRecipientGroupStore{},
	}

	payload := bytes.NewBufferString(`{"name":"relative cpu","database":"telegraf","retentionPolicy":"autogen","measurement":"cpu","field":"usage_user","conditions":[{"level":"critical","value":15,"operator":"greater","enabled":true}],"trigger":"relative","values":{"change":"change","shift":"1m","operator":"greater than"},"taskType":"stream","every":"30s","occurrenceType":"recent","occurrenceCount":2,"occurrenceWindow":"5m","pauseSeconds":60,"notifyRecovery":true,"active":true,"hostnames":["web-1"],"eventHandlers":[{"type":"email","enabled":true,"recipientGroupIds":["rg-1"]}]}`)
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", payload)
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}
	if added.Trigger != cloudhub.AlertGroupRuleTriggerRelative {
		t.Fatalf("trigger = %q, want %q", added.Trigger, cloudhub.AlertGroupRuleTriggerRelative)
	}
	if added.TriggerValues.Shift != "1m" || added.TriggerValues.Operator != "greater than" {
		t.Fatalf("unexpected trigger values: %+v", added.TriggerValues)
	}
	if len(setConditions) != 1 || setConditions[0].Value != 15 {
		t.Fatalf("unexpected conditions: %+v", setConditions)
	}
	if len(setHosts) != 1 || setHosts[0] != "web-1" {
		t.Fatalf("unexpected hosts: %+v", setHosts)
	}
	if len(setEventHandlers) != 1 || setEventHandlers[0].Type != "email" || len(setEventHandlers[0].RecipientGroupIDs) != 1 || setEventHandlers[0].RecipientGroupIDs[0] != "rg-1" {
		t.Fatalf("unexpected event handlers: %+v", setEventHandlers)
	}
}

func TestAlertGroupRuleCreateBuildsEmailTickscriptFromEventHandler(t *testing.T) {
	logger := &mocks.TestLogger{}

	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				r.ID = "rule-email-1"
				return r, nil
			},
			setEventHandlersFunc: func(ctx context.Context, ruleID string, handlers []cloudhub.AlertRuleEventHandler) error {
				return nil
			},
			eventHandlersByRuleFunc: func(context.Context, string) ([]cloudhub.AlertRuleEventHandler, error) {
				return []cloudhub.AlertRuleEventHandler{{
					ID:                "handler-email-1",
					Type:              cloudhub.AlertRuleEventHandlerEmail,
					Enabled:           true,
					ConfigJSON:        []byte(`{"body":"email body {{ .Level }}"}`),
					RecipientGroupIDs: []string{"group-1"},
				}}, nil
			},
			recipientGroupsByHandlerFunc: func(context.Context, string) ([]cloudhub.RecipientGroup, error) {
				return []cloudhub.RecipientGroup{{
					ID:    "group-1",
					OrgID: "org-1",
					Members: []cloudhub.RecipientGroupMember{{
						ID:    "member-1",
						Email: "ops@example.com",
					}},
				}}, nil
			},
		},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
	}

	payload := bytes.NewBufferString(`{"name":"cpu email","database":"telegraf","retentionPolicy":"autogen","measurement":"cpu","field":"usage_user","conditions":[{"level":"critical","value":90,"operator":"greater","enabled":true}],"taskType":"stream","occurrenceType":"consecutive","occurrenceCount":1,"active":true,"eventHandlers":[{"type":"email","enabled":true,"configJson":{"body":"email body {{ .Level }}"},"recipientGroupIds":["group-1"]}]}`)
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", payload)
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}
	var got cloudhub.AlertGroupRule
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.Contains(got.Tickscript, ".email()") {
		t.Fatalf("tickscript does not include email handler:\n%s", got.Tickscript)
	}
	if !strings.Contains(got.Tickscript, ".to('ops@example.com')") {
		t.Fatalf("tickscript does not include event-handler recipient:\n%s", got.Tickscript)
	}
	if !strings.Contains(got.Tickscript, `.details('email body {{ .Level }}')`) {
		t.Fatalf("tickscript does not include event-handler body:\n%s", got.Tickscript)
	}
	if !strings.Contains(got.Tickscript, "|influxDBOut()") {
		t.Fatalf("tickscript should still include alert output:\n%s", got.Tickscript)
	}
}

func TestAlertGroupRuleCreateRejectsInvalidNonEmailEventHandlers(t *testing.T) {
	tests := []struct {
		name       string
		handler    string
		configJSON string
		wantError  string
	}{
		{
			name:       "tcp missing address",
			handler:    "tcp",
			configJSON: `{}`,
			wantError:  "tcp address is required",
		},
		{
			name:       "exec missing command",
			handler:    "exec",
			configJSON: `{}`,
			wantError:  "exec command is required",
		},
		{
			name:       "log missing file path",
			handler:    "log",
			configJSON: `{}`,
			wantError:  "log filePath is required",
		},
		{
			name:       "kafka missing topic",
			handler:    "kafka",
			configJSON: `{"cluster":"default"}`,
			wantError:  "kafka kafka-topic is required",
		},
		{
			name:       "slack missing channel",
			handler:    "slack",
			configJSON: `{"workspace":"default"}`,
			wantError:  "slack channel is required",
		},
		{
			name:       "telegram missing chat id",
			handler:    "telegram",
			configJSON: `{}`,
			wantError:  "telegram chatId is required",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			logger := &mocks.TestLogger{}
			svc := &Service{
				Logger:          logger,
				AlertGroupRules: &fakeAlertGroupRuleStore{},
			}

			payload := bytes.NewBufferString(`{"name":"invalid handler","database":"telegraf","retentionPolicy":"autogen","measurement":"cpu","field":"usage_user","conditions":[{"level":"critical","value":90,"operator":"greater","enabled":true}],"taskType":"stream","occurrenceType":"consecutive","occurrenceCount":1,"active":true,"eventHandlers":[{"type":"` + tt.handler + `","enabled":true,"configJson":` + tt.configJSON + `}]}`)
			req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", payload)
			req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
			rr := httptest.NewRecorder()

			svc.AlertGroupRuleCreate(rr, req)

			if rr.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
			}
			if !strings.Contains(rr.Body.String(), tt.wantError) {
				t.Fatalf("body should mention %q: %s", tt.wantError, rr.Body.String())
			}
		})
	}
}

// TestAlertGroupRuleCreateAllowsNoEventHandlers verifies the "log only" path:
// a rule POST with an empty eventHandlers list is accepted (201) and the
// generated tickscript still routes alerts to InfluxDB (cloudhub_alerts
// measurement) so the alert history is persisted even though no external
// notification channel is configured.
func TestAlertGroupRuleCreateAllowsNoEventHandlers(t *testing.T) {
	logger := &mocks.TestLogger{}

	var capturedHandlers []cloudhub.AlertRuleEventHandler
	svc := &Service{
		Logger: logger,
		AlertGroupRules: &fakeAlertGroupRuleStore{
			addFunc: func(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
				r.ID = "rule-no-handler"
				return r, nil
			},
			setEventHandlersFunc: func(ctx context.Context, ruleID string, handlers []cloudhub.AlertRuleEventHandler) error {
				capturedHandlers = append([]cloudhub.AlertRuleEventHandler(nil), handlers...)
				return nil
			},
			eventHandlersByRuleFunc: func(context.Context, string) ([]cloudhub.AlertRuleEventHandler, error) {
				return nil, nil
			},
		},
		RecipientGroups:           &fakeRecipientGroupStore{},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
	}

	payload := bytes.NewBufferString(`{"name":"cpu no-handler","database":"telegraf","retentionPolicy":"autogen","measurement":"cpu","field":"usage_user","conditions":[{"level":"critical","value":90,"operator":"greater","enabled":true}],"taskType":"stream","occurrenceType":"consecutive","occurrenceCount":1,"active":true}`)
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules", payload)
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleCreate(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}
	if len(capturedHandlers) != 0 {
		t.Fatalf("SetEventHandlers called with non-empty handlers: %+v", capturedHandlers)
	}

	var got cloudhub.AlertGroupRule
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.Contains(got.Tickscript, "var outputMeasurement = 'cloudhub_alerts'") {
		t.Fatalf("tickscript must declare cloudhub_alerts output measurement:\n%s", got.Tickscript)
	}
	if !strings.Contains(got.Tickscript, "|influxDBOut()") {
		t.Fatalf("tickscript must persist alerts via influxDBOut() even without handlers:\n%s", got.Tickscript)
	}
	if !strings.Contains(got.Tickscript, "|alert()") {
		t.Fatalf("tickscript must contain main alert() node:\n%s", got.Tickscript)
	}
	if strings.Contains(got.Tickscript, ".email()") {
		t.Fatalf("tickscript must not emit email() handler when no event handler is registered:\n%s", got.Tickscript)
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

func TestKapacitorRulesDeleteAlsoSoftDeletesV2AlertGroupRule(t *testing.T) {
	const taskID = "alert-group-rule-1"

	deletedTask := false
	kapaSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/kapacitor/v1/tasks/"+taskID {
			t.Fatalf("unexpected kapacitor path: %s", r.URL.Path)
		}

		switch r.Method {
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     taskID,
				"script": "stream\n    |from()\n    |alert()",
				"status": "enabled",
				"type":   "stream",
				"dbrps":  []cloudhub.DBRP{{DB: "telegraf", RP: "autogen"}},
				"link": map[string]interface{}{
					"rel":  "self",
					"href": "/kapacitor/v1/tasks/" + taskID,
				},
			})
		case http.MethodDelete:
			deletedTask = true
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Fatalf("unexpected kapacitor method: %s", r.Method)
		}
	}))
	defer kapaSrv.Close()

	deletedRuleID := ""
	svc := &Service{
		Store: &mocks.Store{
			ServersStore: &mocks.ServersStore{
				GetF: func(context.Context, int) (cloudhub.Server, error) {
					return cloudhub.Server{
						ID:    42,
						SrcID: 1,
						Name:  "kapacitor",
						URL:   kapaSrv.URL,
					}, nil
				},
			},
		},
		AlertGroupRules: &fakeAlertGroupRuleStore{
			deleteFunc: func(ctx context.Context, id string) error {
				deletedRuleID = id
				return nil
			},
		},
		Logger: &mocks.TestLogger{},
	}

	req := httptest.NewRequest(http.MethodDelete, "/cloudhub/v1/sources/1/kapacitors/42/rules/"+taskID, nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "id", Value: "1"},
		{Key: "kid", Value: "42"},
		{Key: "tid", Value: taskID},
	}))
	rr := httptest.NewRecorder()

	svc.KapacitorRulesDelete(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNoContent, rr.Body.String())
	}
	if !deletedTask {
		t.Fatal("expected kapacitor task to be deleted")
	}
	if deletedRuleID != "rule-1" {
		t.Fatalf("deleted alert rule id = %q, want %q", deletedRuleID, "rule-1")
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
		TaskType:         "stream",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "critical", Value: 90, Enabled: true},
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

	payload := bytes.NewBufferString(`{"name":"cpu high","kapacitorId":"11111111-1111-1111-1111-111111111111","database":"Default","retentionPolicy":"autogen","measurement":"cpu","field":"usage_idle","conditions":[{"level":"critical","value":90,"operator":"greater","enabled":true}],"taskType":"stream","every":"30s","occurrenceType":"consecutive","occurrenceCount":1,"occurrenceWindow":"5m","active":true}`)
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

	payload := bytes.NewBufferString(`{"name":"cpu high","kapacitorId":"11111111-1111-1111-1111-111111111111","database":"Default","retentionPolicy":"autogen","measurement":"cpu","field":"usage_idle","conditions":[{"level":"critical","value":90,"operator":"greater","enabled":true}],"taskType":"stream","every":"30s","occurrenceType":"consecutive","occurrenceCount":1,"occurrenceWindow":"5m","active":true}`)
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
		Conditions:       []cloudhub.AlertRuleCondition{{Level: "critical", Value: 90, Operator: "greater", Enabled: true}},
		Trigger:          "threshold",
		TaskType:         "stream",
		Every:            "30s",
		OccurrenceType:   "consecutive",
		OccurrenceCount:  1,
		OccurrenceWindow: "5m",
		Active:           true,
		Hostnames:        []string{"web-1"},
		EventHandlers: []cloudhub.AlertRuleEventHandler{{
			Type:              cloudhub.AlertRuleEventHandlerEmail,
			Enabled:           true,
			RecipientGroupIDs: []string{"rg-1"},
		}},
	}

	var captured cloudhub.AlertGroupRule
	var setHostsCalled, setEventHandlersCalled bool

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
			setEventHandlersFunc: func(ctx context.Context, ruleID string, handlers []cloudhub.AlertRuleEventHandler) error {
				setEventHandlersCalled = true
				if len(handlers) != 1 || handlers[0].Type != cloudhub.AlertRuleEventHandlerEmail || len(handlers[0].RecipientGroupIDs) != 1 || handlers[0].RecipientGroupIDs[0] != "rg-1" {
					t.Errorf("SetEventHandlers: want email [rg-1], got %+v", handlers)
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
		// Existing email handler preserves notification routing.
		RecipientGroups: &fakeRecipientGroupStore{},
	}

	// Partial patch: send only `active=false`; expect every other field to be preserved
	// from `existing`, including the conditions array.
	payload := bytes.NewBufferString(`{"active":false}`)
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
	if len(captured.Conditions) != 1 || captured.Conditions[0].Value != 90 || captured.Conditions[0].Operator != "greater" {
		t.Errorf("Conditions overwritten: %+v", captured.Conditions)
	}
	if captured.Active {
		t.Errorf("Active not patched to false: got true")
	}
	if len(captured.EventHandlers) != 1 || len(captured.EventHandlers[0].RecipientGroupIDs) != 1 || captured.EventHandlers[0].RecipientGroupIDs[0] != "rg-1" {
		t.Errorf("EventHandlers not preserved: %+v", captured.EventHandlers)
	}
	if !setHostsCalled || !setEventHandlersCalled {
		t.Errorf("SetHosts/SetEventHandlers not called: hosts=%v eventHandlers=%v", setHostsCalled, setEventHandlersCalled)
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
					EventHandlers: []cloudhub.AlertRuleEventHandler{{
						ID:                "handler-1",
						Type:              cloudhub.AlertRuleEventHandlerEmail,
						Enabled:           true,
						RecipientGroupIDs: []string{"group-1"},
					}},
				}, nil
			},
			recipientGroupsByHandlerFunc: func(context.Context, string) ([]cloudhub.RecipientGroup, error) {
				return []cloudhub.RecipientGroup{
					{
						ID:    "group-1",
						OrgID: "org-1",
						Members: []cloudhub.RecipientGroupMember{
							{
								ID:       "m-1",
								UserID:   "user-1",
								UserName: "jin",
								Email:    "jin@example.com",
							},
						},
					},
				}, nil
			},
		},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
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
	if len(sentRecipients) != 1 || sentRecipients[0] != "jin@example.com" {
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

	group := cloudhub.RecipientGroup{
		ID:    "group-1",
		OrgID: "org-1",
		Members: []cloudhub.RecipientGroupMember{
			{
				ID:       "m-1",
				UserID:   "user-1",
				UserName: "jin",
				Email:    "jin@example.com",
			},
		},
	}

	svc := &Service{
		Logger: logger,
		RecipientGroups: &fakeRecipientGroupStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
				switch id {
				case "group-1":
					return group, nil
				case "group-2":
					// Different org → handler filters out.
					return cloudhub.RecipientGroup{ID: "group-2", OrgID: "org-2"}, nil
				default:
					return cloudhub.RecipientGroup{}, errors.New("not found")
				}
			},
		},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapacitor.example.com:9094"}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(`{"kapacitorId":"kapa-1","recipientGroupIds":["group-1","group-2"],"title":"임시 제목","message":"임시 메시지"}`))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	if len(sentRecipients) != 1 || sentRecipients[0] != "jin@example.com" {
		t.Fatalf("unexpected recipients: %#v", sentRecipients)
	}
	if sentSubject != "임시 제목" {
		t.Fatalf("subject = %#v, want %q", sentSubject, "임시 제목")
	}
	if sentBody != "임시 메시지" {
		t.Fatalf("body = %#v, want %q", sentBody, "임시 메시지")
	}
}

// Dropped TestAlertGroupRuleTestNotificationUsesManualRecipientsOverride: the request-body
// `recipients` array (direct manual override) was removed from the API; the only inputs are
// `recipientGroupIds` and the saved rule's groups.

// Dropped TestAlertGroupRuleTestNotificationMergesManualAndUserGroupRecipients: same reason
// as above — manual recipient input is no longer supported.

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
		Logger:                    logger,
		RecipientGroups:           &fakeRecipientGroupStore{},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
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
		RecipientGroups: &fakeRecipientGroupStore{
			getFunc: func(_ context.Context, id string) (cloudhub.RecipientGroup, error) {
				return cloudhub.RecipientGroup{
					ID:    "group-1",
					OrgID: "org-1",
					Members: []cloudhub.RecipientGroupMember{{
						ID: "m-1", UserID: "u1", Email: "jinhyeong.kim@snetsystems.co.kr",
					}},
				}, nil
			},
		},
		AlertRecipientMemberPrefs: &fakeAlertRecipientMemberPrefsStore{},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(context.Context, string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: "kapa-1", OrgID: "org-1", URL: "http://kapacitor.example.com:9094"}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/alert-group-rules/test-notification", bytes.NewBufferString(`{"kapacitorId":"kapa-1","recipientGroupIds":["group-1"],"title":"임시 제목","message":"임시 메시지"}`))
	req = req.WithContext(context.WithValue(req.Context(), organizations.ContextKey, "org-1"))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleTestNotification(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if !logger.HasMessage("info", "alert-group test send start org_id=org-1 kapacitor_url=http://kapacitor.example.com:9094 recipients=jinhyeong.kim@snetsystems.co.kr title=임시 제목") {
		t.Fatalf("expected start log, got %#v", logger.Messages)
	}
	if !logger.HasMessage("error", "alert-group test send failed org_id=org-1 kapacitor_url=http://kapacitor.example.com:9094 recipients=jinhyeong.kim@snetsystems.co.kr error=smtp send failed") {
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
