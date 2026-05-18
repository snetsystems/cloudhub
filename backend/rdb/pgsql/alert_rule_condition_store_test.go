package pgsql_test

import (
	"context"
	"sort"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestAlertRuleConditionStore_SetForRule(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	condStore := pgsql.NewAlertRuleConditionStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID: "org1", Name: "disk", Database: "telegraf", Measurement: "disk", Field: "used_percent",
	})
	if err != nil {
		t.Fatalf("Add rule: %v", err)
	}

	if err := condStore.SetForRule(ctx, r.ID, []cloudhub.AlertRuleCondition{
		{Level: "warning", Value: 80, Enabled: true},
		{Level: "critical", Value: 95, Enabled: true},
	}); err != nil {
		t.Fatalf("SetForRule: %v", err)
	}

	got, err := condStore.ByRule(ctx, r.ID)
	if err != nil {
		t.Fatalf("ByRule: %v", err)
	}
	sort.Slice(got, func(i, j int) bool { return got[i].Level < got[j].Level })
	if len(got) != 2 || got[0].Level != "critical" || got[0].Value != 95 || got[1].Level != "warning" {
		t.Fatalf("unexpected conditions: %+v", got)
	}

	// Replace-all: send only critical.
	if err := condStore.SetForRule(ctx, r.ID, []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 99, Enabled: false},
	}); err != nil {
		t.Fatalf("SetForRule replace: %v", err)
	}
	got, _ = condStore.ByRule(ctx, r.ID)
	if len(got) != 1 || got[0].Level != "critical" || got[0].Value != 99 || got[0].Enabled {
		t.Fatalf("replace-all failed: %+v", got)
	}
}
