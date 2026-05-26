package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/roles"
)

type fakeUserSyncRecipientGroupStore struct {
	cloudhub.RecipientGroupStore
	membersByUserIDFunc func(context.Context, string, string) ([]cloudhub.RecipientGroupMember, error)
	getFunc             func(context.Context, string) (cloudhub.RecipientGroup, error)
	updateMemberFunc    func(context.Context, cloudhub.RecipientGroupMember) error
}

func (f *fakeUserSyncRecipientGroupStore) MembersByUserID(ctx context.Context, orgID, userID string) ([]cloudhub.RecipientGroupMember, error) {
	if f.membersByUserIDFunc != nil {
		return f.membersByUserIDFunc(ctx, orgID, userID)
	}
	return nil, nil
}

func (f *fakeUserSyncRecipientGroupStore) Get(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, id)
	}
	return cloudhub.RecipientGroup{}, fmt.Errorf("recipient group %q not found", id)
}

func (f *fakeUserSyncRecipientGroupStore) UpdateMember(ctx context.Context, m cloudhub.RecipientGroupMember) error {
	if f.updateMemberFunc != nil {
		return f.updateMemberFunc(ctx, m)
	}
	return nil
}

func TestSyncAlertRecipientMembersForUserEmailChangeUpdatesMembersAndRegeneratesRules(t *testing.T) {
	user := &cloudhub.User{ID: 42, Name: "alice", Email: "new@example.com"}
	members := []cloudhub.RecipientGroupMember{
		{ID: "m1", RecipientGroupID: "g1", UserID: "42", UserName: "Alice", Email: "old@example.com"},
		{ID: "m2", RecipientGroupID: "g2", UserID: "42", UserName: "Alice", Email: "old@example.com"},
	}

	var updated []cloudhub.RecipientGroupMember
	store := &fakeUserSyncRecipientGroupStore{
		membersByUserIDFunc: func(ctx context.Context, orgID, userID string) ([]cloudhub.RecipientGroupMember, error) {
			if orgID != "org-1" {
				t.Fatalf("orgID = %q, want org-1", orgID)
			}
			if userID != "42" {
				t.Fatalf("userID = %q, want 42", userID)
			}
			return members, nil
		},
		getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
			return cloudhub.RecipientGroup{ID: id, OrgID: "org-1"}, nil
		},
		updateMemberFunc: func(ctx context.Context, m cloudhub.RecipientGroupMember) error {
			updated = append(updated, m)
			return nil
		},
	}

	svc := &Service{
		Logger:          mocks.NewLogger(),
		RecipientGroups: store,
		AlertGroupRules: &fakeAlertRuleStore{
			rulesByRecipientGroup: map[string][]cloudhub.AlertGroupRule{
				"g1": {{ID: "r1", OrgID: "org-1"}},
				"g2": {{ID: "r2", OrgID: "org-1"}},
			},
		},
	}

	var synced []string
	regenRuleSyncHook = func(ctx context.Context, rule cloudhub.AlertGroupRule) error {
		synced = append(synced, rule.ID)
		return nil
	}
	t.Cleanup(func() { regenRuleSyncHook = nil })

	if err := svc.syncAlertRecipientMembersForUserEmailChange(context.Background(), "org-1", user, "old@example.com"); err != nil {
		t.Fatalf("syncAlertRecipientMembersForUserEmailChange: %v", err)
	}

	if len(updated) != 2 {
		t.Fatalf("updated members = %d, want 2", len(updated))
	}
	for _, m := range updated {
		if m.Email != "new@example.com" {
			t.Fatalf("updated email = %q, want new@example.com", m.Email)
		}
		if m.UserName != "alice" {
			t.Fatalf("updated user name = %q, want alice", m.UserName)
		}
	}
	if len(synced) != 2 {
		t.Fatalf("synced rules = %v, want r1 and r2", synced)
	}
	seen := map[string]bool{}
	for _, id := range synced {
		seen[id] = true
	}
	if !seen["r1"] || !seen["r2"] {
		t.Fatalf("synced rules = %v, want r1 and r2", synced)
	}
}

func TestSyncAlertRecipientMembersForUserEmailChangeSkipsUnchangedEmail(t *testing.T) {
	svc := &Service{
		Logger: mocks.NewLogger(),
		RecipientGroups: &fakeUserSyncRecipientGroupStore{
			membersByUserIDFunc: func(context.Context, string, string) ([]cloudhub.RecipientGroupMember, error) {
				t.Fatal("MembersByUserID should not be called when email did not change")
				return nil, nil
			},
		},
	}

	user := &cloudhub.User{ID: 42, Name: "alice", Email: "same@example.com"}
	if err := svc.syncAlertRecipientMembersForUserEmailChange(context.Background(), "org-1", user, "same@example.com"); err != nil {
		t.Fatalf("syncAlertRecipientMembersForUserEmailChange: %v", err)
	}
}

func TestUpdateUserSyncsAlertRecipientsOnEmailChange(t *testing.T) {
	var updatedMember cloudhub.RecipientGroupMember
	recipientGroups := &fakeUserSyncRecipientGroupStore{
		membersByUserIDFunc: func(ctx context.Context, orgID, userID string) ([]cloudhub.RecipientGroupMember, error) {
			if orgID != "" {
				t.Fatalf("orgID = %q, want empty for global user update", orgID)
			}
			if userID != "42" {
				t.Fatalf("userID = %q, want 42", userID)
			}
			return []cloudhub.RecipientGroupMember{{
				ID:               "m1",
				RecipientGroupID: "g1",
				UserID:           "42",
				UserName:         "Alice",
				Email:            "old@example.com",
			}}, nil
		},
		getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
			return cloudhub.RecipientGroup{ID: id, OrgID: "org-1"}, nil
		},
		updateMemberFunc: func(ctx context.Context, m cloudhub.RecipientGroupMember) error {
			updatedMember = m
			return nil
		},
	}

	svc := &Service{
		Store: &mocks.Store{
			UsersStore: &mocks.UsersStore{
				GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
					return &cloudhub.User{
						ID:       42,
						Name:     "alice",
						Email:    "old@example.com",
						Provider: "cloudhub",
						Scheme:   "basic",
					}, nil
				},
				UpdateF: func(ctx context.Context, user *cloudhub.User) error {
					if user.Email != "new@example.com" {
						t.Fatalf("updated user email = %q, want new@example.com", user.Email)
					}
					return nil
				},
			},
			SourcesStore: &mocks.SourcesStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Source, error) {
					return cloudhub.Source{}, fmt.Errorf("source not configured")
				},
			},
		},
		Logger:          log.New(log.DebugLevel),
		RecipientGroups: recipientGroups,
		AlertGroupRules: &fakeAlertRuleStore{
			rulesByRecipientGroup: map[string][]cloudhub.AlertGroupRule{
				"g1": {{ID: "r1", OrgID: "org-1"}},
			},
		},
	}

	var synced []string
	regenRuleSyncHook = func(ctx context.Context, rule cloudhub.AlertGroupRule) error {
		synced = append(synced, rule.ID)
		return nil
	}
	t.Cleanup(func() { regenRuleSyncHook = nil })

	body, _ := json.Marshal(userRequest{ID: 42, Email: "new@example.com"})
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v1/users/42", bytes.NewReader(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "42"}}))
	req = req.WithContext(context.WithValue(req.Context(), UserContextKey, &cloudhub.User{ID: 7, Name: "admin"}))
	rr := httptest.NewRecorder()

	svc.UpdateUser(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rr.Code, rr.Body.String())
	}
	if updatedMember.Email != "new@example.com" {
		t.Fatalf("recipient member email = %q, want new@example.com", updatedMember.Email)
	}
	if updatedMember.UserName != "alice" {
		t.Fatalf("recipient member user name = %q, want alice", updatedMember.UserName)
	}
	if len(synced) != 1 || synced[0] != "r1" {
		t.Fatalf("synced rules = %v, want [r1]", synced)
	}
}

func TestOrganizationNewUserSyncsEmailToDefaultRecipientGroup(t *testing.T) {
	var savedUser *cloudhub.User
	rgStore := &memRecipientGroupStore{members: map[string][]cloudhub.RecipientGroupMember{}}
	svc := &Service{
		Store: &mocks.Store{
			ConfigStore: &mocks.ConfigStore{
				Config: &cloudhub.Config{
					Auth: cloudhub.AuthConfig{SuperAdminNewUsers: false},
				},
			},
			OrganizationsStore: &mocks.OrganizationsStore{
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org-1", Name: "Acme Ops", DefaultRole: roles.ViewerRoleName}, nil
				},
			},
			UsersStore: &mocks.UsersStore{
				AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
					u := *user
					u.ID = 42
					savedUser = &u
					return savedUser, nil
				},
				AllF: func(ctx context.Context) ([]cloudhub.User, error) {
					if savedUser == nil {
						return nil, nil
					}
					return []cloudhub.User{*savedUser}, nil
				},
			},
			SourcesStore: &mocks.SourcesStore{
				GetF: func(ctx context.Context, id int) (cloudhub.Source, error) {
					return cloudhub.Source{}, fmt.Errorf("source not configured")
				},
			},
		},
		Logger:                    log.New(log.DebugLevel),
		RecipientGroups:           rgStore,
		AlertRecipientGroups:      &memAlertRecipientGroupStore{ext: map[string]cloudhub.AlertRecipientGroup{}},
		AlertRecipientMemberPrefs: &memAlertRecipientMemberPrefsStore{prefs: map[string]cloudhub.AlertRecipientMemberPrefs{}},
	}

	body, _ := json.Marshal(userRequest{
		Name:     "alice",
		Provider: "cloudhub",
		Scheme:   "basic",
		Email:    "alice@example.com",
		Roles: []cloudhub.Role{{
			Organization: "org-1",
			Name:         roles.AdminRoleName,
		}},
	})
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/organizations/org-1/users", bytes.NewReader(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "oid", Value: "org-1"}}))
	req = req.WithContext(context.WithValue(req.Context(), UserContextKey, &cloudhub.User{ID: 7, Name: "admin", SuperAdmin: true}))
	rr := httptest.NewRecorder()

	svc.OrganizationNewUser(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rr.Code, rr.Body.String())
	}
	groups, err := rgStore.All(context.Background(), "org-1")
	if err != nil {
		t.Fatalf("recipient groups: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Members) != 1 {
		t.Fatalf("expected default group with one member, got %+v", groups)
	}
	if groups[0].Members[0].Email != "alice@example.com" {
		t.Fatalf("recipient member email = %q, want alice@example.com", groups[0].Members[0].Email)
	}
}
