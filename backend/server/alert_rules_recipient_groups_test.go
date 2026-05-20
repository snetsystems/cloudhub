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

func TestAlertGroupRuleSetRecipientGroupsRegeneratesRule(t *testing.T) {
	var setRuleID string
	var regenerated []string
	oldHook := regenRuleSyncHook
	regenRuleSyncHook = func(ctx context.Context, rule cloudhub.AlertGroupRule) error {
		regenerated = append(regenerated, rule.ID)
		return nil
	}
	defer func() { regenRuleSyncHook = oldHook }()

	svc := &Service{
		AlertGroupRules: &fakeAlertGroupRuleStore{
			setRecipientGroupsFunc: func(ctx context.Context, ruleID string, recipientGroupIDs []string) error {
				setRuleID = ruleID
				return nil
			},
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
				return cloudhub.AlertGroupRule{ID: id, OrgID: "org-1"}, nil
			},
		},
		Logger: &mocks.TestLogger{},
	}

	req := httptest.NewRequest(http.MethodPut, "/cloudhub/v2/alert-group-rules/rule-1/recipient-groups", bytes.NewBufferString(`{"recipientGroupIds":["group-1"]}`))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "rule-1"}}))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleSetRecipientGroups(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNoContent, rr.Body.String())
	}
	if setRuleID != "rule-1" {
		t.Fatalf("setRuleID = %q, want rule-1", setRuleID)
	}
	if len(regenerated) != 1 || regenerated[0] != "rule-1" {
		t.Fatalf("regenerated = %v, want [rule-1]", regenerated)
	}
}
