package server

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func TestRemoveRecipientGroupRejectsDefaultGroup(t *testing.T) {
	deleteCalled := false
	svc := &Service{
		RecipientGroups: &fakeRecipientGroupStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
				return cloudhub.RecipientGroup{
					ID:        id,
					IsDefault: true,
				}, nil
			},
			deleteFunc: func(ctx context.Context, id string) error {
				deleteCalled = true
				return nil
			},
		},
		Logger: &mocks.TestLogger{},
	}

	req := httptest.NewRequest(http.MethodDelete, "/cloudhub/v1/recipient-groups/group-1", nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "id", Value: "group-1"},
	}))
	rr := httptest.NewRecorder()

	svc.RemoveRecipientGroup(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusConflict, rr.Body.String())
	}
	if deleteCalled {
		t.Fatal("default recipient group should not be deleted")
	}
}

func TestUpdateRecipientGroupAllowsDefaultGroupName(t *testing.T) {
	var updated cloudhub.RecipientGroup
	svc := &Service{
		RecipientGroups: &fakeRecipientGroupStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
				return cloudhub.RecipientGroup{
					ID:        id,
					Name:      "Default",
					IsDefault: true,
				}, nil
			},
			updateFunc: func(ctx context.Context, g cloudhub.RecipientGroup) error {
				updated = g
				return nil
			},
		},
		Logger: &mocks.TestLogger{},
	}

	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v1/recipient-groups/group-1", bytes.NewBufferString(`{"name":"Ops Default"}`))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "id", Value: "group-1"},
	}))
	rr := httptest.NewRecorder()

	svc.UpdateRecipientGroup(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if updated.Name != "Ops Default" || !updated.IsDefault {
		t.Fatalf("updated group = %#v, want renamed default group", updated)
	}
}

func TestRemoveRecipientGroupMemberRejectsDefaultGroup(t *testing.T) {
	deleteMemberCalled := false
	svc := &Service{
		RecipientGroups: &fakeRecipientGroupStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
				return cloudhub.RecipientGroup{
					ID:        id,
					IsDefault: true,
					Members: []cloudhub.RecipientGroupMember{
						{ID: "member-1", RecipientGroupID: id, Email: "user@example.com"},
					},
				}, nil
			},
			deleteMemberFunc: func(ctx context.Context, memberID string) error {
				deleteMemberCalled = true
				return nil
			},
		},
		Logger: &mocks.TestLogger{},
	}

	req := httptest.NewRequest(http.MethodDelete, "/cloudhub/v1/recipient-groups/group-1/members/member-1", nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "id", Value: "group-1"},
		{Key: "memberId", Value: "member-1"},
	}))
	rr := httptest.NewRecorder()

	svc.RemoveRecipientGroupMember(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusConflict, rr.Body.String())
	}
	if deleteMemberCalled {
		t.Fatal("default recipient group member should not be deleted")
	}
}

func TestUpdateRecipientGroupMemberAllowsDefaultGroupMember(t *testing.T) {
	var updated cloudhub.RecipientGroupMember
	svc := &Service{
		RecipientGroups: &fakeRecipientGroupStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
				return cloudhub.RecipientGroup{
					ID:        id,
					IsDefault: true,
					Members: []cloudhub.RecipientGroupMember{
						{ID: "member-1", RecipientGroupID: id, UserName: "before", Email: "before@example.com"},
					},
				}, nil
			},
			updateMemberFunc: func(ctx context.Context, m cloudhub.RecipientGroupMember) error {
				updated = m
				return nil
			},
		},
		Logger: &mocks.TestLogger{},
	}

	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v1/recipient-groups/group-1/members/member-1", bytes.NewBufferString(`{"userName":"after","email":"after@example.com"}`))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "id", Value: "group-1"},
		{Key: "memberId", Value: "member-1"},
	}))
	rr := httptest.NewRecorder()

	svc.UpdateRecipientGroupMember(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if updated.UserName != "after" || updated.Email != "after@example.com" {
		t.Fatalf("updated member = %#v, want edited member", updated)
	}
}

func TestRecipientGroupMemberChangesRegenerateLinkedRules(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		target     string
		body       string
		handler    func(*Service, http.ResponseWriter, *http.Request)
		wantStatus int
	}{
		{
			name:       "add member",
			method:     http.MethodPost,
			target:     "/cloudhub/v2/recipient-groups/group-1/members",
			body:       `{"userId":"u1","userName":"New","email":"new@example.com"}`,
			handler:    (*Service).NewRecipientGroupMember,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "add external member",
			method:     http.MethodPost,
			target:     "/cloudhub/v2/recipient-groups/group-1/members",
			body:       `{"isExternal":true,"userName":"Vendor","email":"vendor@example.com"}`,
			handler:    (*Service).NewRecipientGroupMember,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "update member",
			method:     http.MethodPatch,
			target:     "/cloudhub/v2/recipient-groups/group-1/members/member-1",
			body:       `{"email":"after@example.com"}`,
			handler:    (*Service).UpdateRecipientGroupMember,
			wantStatus: http.StatusOK,
		},
		{
			name:       "delete member",
			method:     http.MethodDelete,
			target:     "/cloudhub/v2/recipient-groups/group-1/members/member-1",
			handler:    (*Service).RemoveRecipientGroupMember,
			wantStatus: http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var regenerated []string
			oldHook := regenRuleSyncHook
			regenRuleSyncHook = func(ctx context.Context, rule cloudhub.AlertGroupRule) error {
				regenerated = append(regenerated, rule.ID)
				return nil
			}
			defer func() { regenRuleSyncHook = oldHook }()

			group := cloudhub.RecipientGroup{
				ID:    "group-1",
				OrgID: "org-1",
				Members: []cloudhub.RecipientGroupMember{
					{ID: "member-1", RecipientGroupID: "group-1", Email: "before@example.com"},
				},
			}
			svc := &Service{
				RecipientGroups: &fakeRecipientGroupStore{
					getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
						return group, nil
					},
					addMemberFunc: func(ctx context.Context, m cloudhub.RecipientGroupMember) (cloudhub.RecipientGroupMember, error) {
						m.ID = "member-2"
						return m, nil
					},
				},
				AlertGroupRules: &fakeAlertGroupRuleStore{
					rulesByRecipientGroupFunc: func(ctx context.Context, recipientGroupID string) ([]cloudhub.AlertGroupRule, error) {
						if recipientGroupID != "group-1" {
							t.Fatalf("recipientGroupID = %q, want group-1", recipientGroupID)
						}
						return []cloudhub.AlertGroupRule{{ID: "rule-1", OrgID: "org-1"}}, nil
					},
				},
				Logger: &mocks.TestLogger{},
			}

			req := httptest.NewRequest(tt.method, tt.target, bytes.NewBufferString(tt.body))
			req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
				{Key: "id", Value: "group-1"},
				{Key: "memberId", Value: "member-1"},
			}))
			rr := httptest.NewRecorder()

			tt.handler(svc, rr, req)

			if rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body=%s", rr.Code, tt.wantStatus, rr.Body.String())
			}
			if len(regenerated) != 1 || regenerated[0] != "rule-1" {
				t.Fatalf("regenerated = %v, want [rule-1]", regenerated)
			}
		})
	}
}
