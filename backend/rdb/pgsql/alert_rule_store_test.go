package pgsql_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestAlertRuleStore_AddAndGet(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	store := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := store.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:       "org1",
		Name:        "CPU",
		Measurement: "cpu",
		Field:       "usage_user",
		Conditions: []cloudhub.AlertCondition{
			{Level: "warning", Value: "70", Enabled: true},
			{Level: "critical", Value: "90", Enabled: true},
		},
		Recipients:      []string{"ops@example.com", "oncall@example.com"},
		TriggerOperator: "greater",
		TaskType:        "stream",
		OccurrenceCount: 1,
		Active:          true,
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	if r.ID == "" {
		t.Fatal("expected non-empty ID")
	}

	got, err := store.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != "CPU" {
		t.Errorf("Name = %q, want %q", got.Name, "CPU")
	}
	if len(got.Conditions) != 2 {
		t.Errorf("Conditions len = %d, want 2", len(got.Conditions))
	}
	if len(got.Recipients) != 2 || got.Recipients[0] != "ops@example.com" || got.Recipients[1] != "oncall@example.com" {
		t.Errorf("Recipients round-trip failed: got %v, want [ops@example.com oncall@example.com]", got.Recipients)
	}
}

func TestAlertRuleStore_SetHosts(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	rule, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org1", Name: "mem", Active: true})

	if err := ruleStore.SetHosts(ctx, rule.ID, []string{"web-1", "web-2"}); err != nil {
		t.Fatalf("SetHosts: %v", err)
	}

	got, err := ruleStore.Get(ctx, rule.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(got.Hostnames) != 2 {
		t.Fatalf("Hostnames len = %d, want 2", len(got.Hostnames))
	}
	want := map[string]bool{"web-1": true, "web-2": true}
	for _, n := range got.Hostnames {
		if !want[n] {
			t.Errorf("unexpected hostname %q", n)
		}
	}

	names, err := ruleStore.Hostnames(ctx, rule.ID)
	if err != nil {
		t.Fatalf("Hostnames: %v", err)
	}
	if len(names) != 2 {
		t.Errorf("Hostnames = %v, want 2 entries", names)
	}
}

func TestAlertRuleStore_UserGroupsByRule_NoTags(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	ugStore := pgsql.NewUserGroupStore(client)
	ctx := context.Background()

	rule, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org2", Name: "disk", Active: true})
	_, _ = ugStore.Add(ctx, cloudhub.UserGroup{OrgID: "org2", Name: "team-a", ReceiveLevel: "all"})
	_, _ = ugStore.Add(ctx, cloudhub.UserGroup{OrgID: "org2", Name: "team-b", ReceiveLevel: "all"})

	// No tags set => all user_groups in org
	groups, err := ruleStore.UserGroupsByRule(ctx, rule.ID)
	if err != nil {
		t.Fatalf("UserGroupsByRule: %v", err)
	}
	if len(groups) < 2 {
		t.Errorf("got %d groups, want >= 2", len(groups))
	}
}
