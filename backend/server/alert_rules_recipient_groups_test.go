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

func TestAlertGroupRuleSetEventHandlersRegeneratesRule(t *testing.T) {
	var setRuleID string
	var setHandlers []cloudhub.AlertRuleEventHandler
	var regenerated []string
	oldHook := regenRuleSyncHook
	regenRuleSyncHook = func(ctx context.Context, rule cloudhub.AlertGroupRule) error {
		regenerated = append(regenerated, rule.ID)
		return nil
	}
	defer func() { regenRuleSyncHook = oldHook }()

	svc := &Service{
		AlertGroupRules: &fakeAlertGroupRuleStore{
			setEventHandlersFunc: func(ctx context.Context, ruleID string, handlers []cloudhub.AlertRuleEventHandler) error {
				setRuleID = ruleID
				setHandlers = handlers
				return nil
			},
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
				return cloudhub.AlertGroupRule{ID: id, OrgID: "org-1"}, nil
			},
		},
		Logger: &mocks.TestLogger{},
	}

	req := httptest.NewRequest(http.MethodPut, "/cloudhub/v2/alert-group-rules/rule-1/event-handlers", bytes.NewBufferString(`{"eventHandlers":[{"type":"email","enabled":true,"recipientGroupIds":["group-1"]}]}`))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: "rule-1"}}))
	rr := httptest.NewRecorder()

	svc.AlertGroupRuleSetEventHandlers(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNoContent, rr.Body.String())
	}
	if setRuleID != "rule-1" {
		t.Fatalf("setRuleID = %q, want rule-1", setRuleID)
	}
	if len(setHandlers) != 1 || setHandlers[0].Type != "email" || len(setHandlers[0].RecipientGroupIDs) != 1 {
		t.Fatalf("setHandlers = %+v, want email handler with group-1", setHandlers)
	}
	if len(regenerated) != 1 || regenerated[0] != "rule-1" {
		t.Fatalf("regenerated = %v, want [rule-1]", regenerated)
	}
}
