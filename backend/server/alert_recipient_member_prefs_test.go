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

func TestAlertRecipientMemberPrefsBulkUpsertRegeneratesLinkedRules(t *testing.T) {
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
			{ID: "member-1", RecipientGroupID: "group-1", Email: "member@example.com"},
		},
	}
	svc := &Service{
		RecipientGroups: &fakeRecipientGroupStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
				return group, nil
			},
		},
		AlertRecipientMemberPrefs: &memAlertRecipientMemberPrefsStore{prefs: map[string]cloudhub.AlertRecipientMemberPrefs{}},
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

	body := `{"alertRecipientMemberPrefs":[{"recipientGroupMemberId":"member-1","emailEnabled":true,"emailLevel":"critical"}]}`
	req := httptest.NewRequest(http.MethodPut, "/cloudhub/v2/recipient-groups/group-1/alert-prefs", bytes.NewBufferString(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "group-1"}}))
	rr := httptest.NewRecorder()

	svc.AlertRecipientMemberPrefsBulkUpsert(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if len(regenerated) != 1 || regenerated[0] != "rule-1" {
		t.Fatalf("regenerated = %v, want [rule-1]", regenerated)
	}
}
