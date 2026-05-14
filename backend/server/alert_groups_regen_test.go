package server

import (
	"context"
	"fmt"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

type fakeAlertRuleStore struct {
	cloudhub.AlertGroupRuleStore
	rules            []cloudhub.AlertGroupRule
	userGroups       map[string][]cloudhub.UserGroup
	rulesByUserGroup map[string][]cloudhub.AlertGroupRule
}

func (f *fakeAlertRuleStore) All(ctx context.Context, orgID string) ([]cloudhub.AlertGroupRule, error) {
	var out []cloudhub.AlertGroupRule
	for _, r := range f.rules {
		if r.OrgID == orgID {
			out = append(out, r)
		}
	}
	return out, nil
}

func (f *fakeAlertRuleStore) Get(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
	for _, r := range f.rules {
		if r.ID == id {
			return r, nil
		}
	}
	return cloudhub.AlertGroupRule{}, fmt.Errorf("alert rule %q not found", id)
}

func (f *fakeAlertRuleStore) UserGroupsByRule(ctx context.Context, ruleID string) ([]cloudhub.UserGroup, error) {
	return f.userGroups[ruleID], nil
}

func (f *fakeAlertRuleStore) RulesByUserGroup(ctx context.Context, userGroupID string) ([]cloudhub.AlertGroupRule, error) {
	return f.rulesByUserGroup[userGroupID], nil
}

func TestRegenerateRulesByUserGroup_SyncsLinkedRules(t *testing.T) {
	rules := []cloudhub.AlertGroupRule{
		{ID: "r1", OrgID: "o1", UserGroupIDs: []string{"g1"}, Active: true},
		{ID: "r3", OrgID: "o1", UserGroupIDs: []string{"g1"}, Active: true},
	}
	store := &fakeAlertRuleStore{
		rules: rules,
		rulesByUserGroup: map[string][]cloudhub.AlertGroupRule{
			"g1": {rules[0], rules[1]},
		},
	}
	s := &Service{
		Logger:          mocks.NewLogger(),
		AlertGroupRules: store,
	}
	var synced []string
	regenRuleSyncHook = func(ctx context.Context, rule cloudhub.AlertGroupRule) error {
		synced = append(synced, rule.ID)
		return nil
	}
	t.Cleanup(func() { regenRuleSyncHook = nil })

	group := cloudhub.UserGroup{ID: "g1"}
	if err := s.RegenerateRulesByUserGroup(context.Background(), "o1", group); err != nil {
		t.Fatalf("RegenerateRulesByUserGroup: %v", err)
	}
	if len(synced) != 2 {
		t.Fatalf("expected 2 rules synced, got %v", synced)
	}
	seen := map[string]bool{}
	for _, id := range synced {
		seen[id] = true
	}
	if !seen["r1"] || !seen["r3"] {
		t.Fatalf("expected r1 and r3 synced, got %v", synced)
	}
}

func TestRegenerateRulesByUserGroup_FiltersByOrg(t *testing.T) {
	store := &fakeAlertRuleStore{
		rulesByUserGroup: map[string][]cloudhub.AlertGroupRule{
			"g1": {
				{ID: "r1", OrgID: "o1", Active: true},
				{ID: "r2", OrgID: "other", Active: true},
			},
		},
	}
	s := &Service{
		Logger:          mocks.NewLogger(),
		AlertGroupRules: store,
	}
	var synced []string
	regenRuleSyncHook = func(ctx context.Context, rule cloudhub.AlertGroupRule) error {
		synced = append(synced, rule.ID)
		return nil
	}
	t.Cleanup(func() { regenRuleSyncHook = nil })

	group := cloudhub.UserGroup{ID: "g1"}
	if err := s.RegenerateRulesByUserGroup(context.Background(), "o1", group); err != nil {
		t.Fatalf("RegenerateRulesByUserGroup: %v", err)
	}
	if len(synced) != 1 || synced[0] != "r1" {
		t.Fatalf("expected only r1 synced, got %v", synced)
	}
}
