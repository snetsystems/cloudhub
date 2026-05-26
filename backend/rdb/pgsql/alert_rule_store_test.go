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

	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:       "org1",
		Name:        "CPU",
		Measurement: "cpu",
		Field:       "usage_user",
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "warning", Value: 70, Enabled: true},
			{Level: "critical", Value: 90, Enabled: true},
		},
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

	// Attach hosts and recipient groups.
	if err := ruleStore.SetHosts(ctx, r.ID, []string{"web-1", "web-2"}); err != nil {
		t.Fatalf("SetHosts: %v", err)
	}

	got, err := ruleStore.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != "CPU" {
		t.Errorf("Name = %q, want %q", got.Name, "CPU")
	}
	if len(got.Conditions) != 2 {
		t.Errorf("Conditions len = %d, want 2", len(got.Conditions))
	}
	if len(got.Hostnames) != 2 {
		t.Errorf("Hostnames len = %d, want 2", len(got.Hostnames))
	}
}

func TestAlertRuleStore_Update(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID: "org1", Name: "mem", Active: true,
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}

	r.Name = "memory-usage"
	if err := ruleStore.Update(ctx, r); err != nil {
		t.Fatalf("Update: %v", err)
	}

	got, err := ruleStore.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != "memory-usage" {
		t.Errorf("Name after Update = %q, want %q", got.Name, "memory-usage")
	}
}

func TestAlertRuleStore_TriggerValues(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:   "org1",
		Name:    "relative cpu",
		Trigger: cloudhub.AlertGroupRuleTriggerRelative,
		TriggerValues: cloudhub.TriggerValues{
			Change:   "change",
			Shift:    "2m",
			Operator: "greater than",
		},
		Active: true,
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}

	got, err := ruleStore.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.TriggerValues.Change != "change" || got.TriggerValues.Shift != "2m" || got.TriggerValues.Operator != "greater than" {
		t.Fatalf("TriggerValues not hydrated: %+v", got.TriggerValues)
	}

	got.Trigger = cloudhub.AlertGroupRuleTriggerDeadman
	got.TriggerValues = cloudhub.TriggerValues{Period: "3m"}
	if err := ruleStore.Update(ctx, got); err != nil {
		t.Fatalf("Update: %v", err)
	}
	got, err = ruleStore.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get after update: %v", err)
	}
	if got.TriggerValues.Period != "3m" || got.TriggerValues.Shift != "" {
		t.Fatalf("TriggerValues not replaced on update: %+v", got.TriggerValues)
	}
}

func TestAlertRuleStore_SoftDelete(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org1", Name: "disk", Active: true})

	if err := ruleStore.Delete(ctx, r.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := ruleStore.Get(ctx, r.ID); err == nil {
		t.Fatalf("expected Get to fail for soft-deleted row")
	}
	list, err := ruleStore.All(ctx, "org1")
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	for _, x := range list {
		if x.ID == r.ID {
			t.Fatalf("soft-deleted rule still listed in All: %s", x.ID)
		}
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

	names, err := ruleStore.Hostnames(ctx, rule.ID)
	if err != nil {
		t.Fatalf("Hostnames: %v", err)
	}
	if len(names) != 2 {
		t.Errorf("Hostnames = %v, want 2 entries", names)
	}

	// Replace-all semantics: a fresh set wipes the previous entries.
	if err := ruleStore.SetHosts(ctx, rule.ID, []string{"web-3"}); err != nil {
		t.Fatalf("SetHosts replace: %v", err)
	}
	names, _ = ruleStore.Hostnames(ctx, rule.ID)
	if len(names) != 1 || names[0] != "web-3" {
		t.Errorf("after replace, hostnames = %v, want [web-3]", names)
	}
}

func TestAlertRuleStore_SetEventHandlers_ReplaceAll(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	rgStore := pgsql.NewRecipientGroupStore(client)
	ctx := context.Background()

	rule, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org2", Name: "disk", Active: true})
	g1, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org2", Name: "team-a"})
	g2, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org2", Name: "team-b"})
	g3, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org2", Name: "team-c"})

	if err := ruleStore.SetEventHandlers(ctx, rule.ID, []cloudhub.AlertRuleEventHandler{
		{Type: "email", Enabled: true, RecipientGroupIDs: []string{g1.ID, g2.ID}},
		{Type: "sms", Enabled: true, RecipientGroupIDs: []string{g3.ID}},
		{Type: "slack", Enabled: true, ConfigJSON: []byte(`{"workspace":"default","channel":"#alerts"}`), RecipientGroupIDs: []string{g1.ID}},
	}); err != nil {
		t.Fatalf("SetEventHandlers: %v", err)
	}
	got, err := ruleStore.EventHandlersByRule(ctx, rule.ID)
	if err != nil {
		t.Fatalf("EventHandlersByRule: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("want 3 event handlers, got %d", len(got))
	}
	byType := map[string]cloudhub.AlertRuleEventHandler{}
	for _, h := range got {
		byType[h.Type] = h
	}
	if len(byType["email"].RecipientGroupIDs) != 2 {
		t.Fatalf("email handler not hydrated: %+v", got)
	}
	if len(byType["sms"].RecipientGroupIDs) != 1 {
		t.Fatalf("sms handler not hydrated: %+v", got)
	}
	if len(byType["slack"].RecipientGroupIDs) != 0 {
		t.Fatalf("slack handler should not hydrate recipient groups: %+v", got)
	}

	// Replace-all: drop sms handler and replace email groups.
	if err := ruleStore.SetEventHandlers(ctx, rule.ID, []cloudhub.AlertRuleEventHandler{
		{Type: "email", Enabled: true, RecipientGroupIDs: []string{g1.ID, g3.ID}},
	}); err != nil {
		t.Fatalf("SetEventHandlers replace: %v", err)
	}
	got, _ = ruleStore.EventHandlersByRule(ctx, rule.ID)
	if len(got) != 1 {
		t.Fatalf("after replace want 1 handler, got %d", len(got))
	}
	gotIDs := map[string]bool{got[0].RecipientGroupIDs[0]: true, got[0].RecipientGroupIDs[1]: true}
	if !gotIDs[g1.ID] || !gotIDs[g3.ID] || gotIDs[g2.ID] {
		t.Fatalf("after replace want {g1, g3}, got %+v", gotIDs)
	}
}

func TestAlertRuleStore_RulesByRecipientGroupUsesEventHandlerBindings(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	rgStore := pgsql.NewRecipientGroupStore(client)
	ctx := context.Background()

	g, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org3", Name: "ops"})
	r1, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org3", Name: "r1", Active: true})
	r2, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org3", Name: "r2", Active: true})
	other, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org3", Name: "other", Active: true})

	if err := ruleStore.SetEventHandlers(ctx, r1.ID, []cloudhub.AlertRuleEventHandler{
		{Type: "email", Enabled: true, RecipientGroupIDs: []string{g.ID}},
	}); err != nil {
		t.Fatalf("SetEventHandlers r1: %v", err)
	}
	if err := ruleStore.SetEventHandlers(ctx, r2.ID, []cloudhub.AlertRuleEventHandler{
		{Type: "sms", Enabled: true, RecipientGroupIDs: []string{g.ID}},
	}); err != nil {
		t.Fatalf("SetEventHandlers r2: %v", err)
	}

	rules, err := ruleStore.RulesByRecipientGroup(ctx, g.ID)
	if err != nil {
		t.Fatalf("RulesByRecipientGroup: %v", err)
	}
	if len(rules) != 2 {
		t.Fatalf("want 2 rules linked to group, got %d", len(rules))
	}
	for _, r := range rules {
		if r.ID == other.ID {
			t.Fatalf("unlinked rule %q should not appear", other.ID)
		}
	}
}

func TestAlertRuleStore_RulesByRecipientGroupIncludesAllGroupHandlersInSameOrg(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	rgStore := pgsql.NewRecipientGroupStore(client)
	ctx := context.Background()

	g, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org4", Name: "ops"})
	r1, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "org4", Name: "all email", Active: true})
	otherOrgRule, _ := ruleStore.Add(ctx, cloudhub.AlertGroupRule{OrgID: "other-org", Name: "other", Active: true})

	if err := ruleStore.SetEventHandlers(ctx, r1.ID, []cloudhub.AlertRuleEventHandler{
		{Type: "email", Enabled: true},
	}); err != nil {
		t.Fatalf("SetEventHandlers r1: %v", err)
	}
	if err := ruleStore.SetEventHandlers(ctx, otherOrgRule.ID, []cloudhub.AlertRuleEventHandler{
		{Type: "email", Enabled: true},
	}); err != nil {
		t.Fatalf("SetEventHandlers other: %v", err)
	}

	rules, err := ruleStore.RulesByRecipientGroup(ctx, g.ID)
	if err != nil {
		t.Fatalf("RulesByRecipientGroup: %v", err)
	}
	if len(rules) != 1 || rules[0].ID != r1.ID {
		t.Fatalf("want only same-org all-group rule %s, got %+v", r1.ID, rules)
	}
}

func TestAlertRuleStore_ConditionsRoundTrip(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:       "org4",
		Name:        "thresh",
		Measurement: "cpu",
		Field:       "usage_user",
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "info", Value: 50, Enabled: true},
			{Level: "warning", Value: 70, Enabled: true},
			{Level: "critical", Value: 90, Enabled: false},
		},
		Active: true,
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}

	got, err := ruleStore.ConditionsByRule(ctx, r.ID)
	if err != nil {
		t.Fatalf("ConditionsByRule: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("want 3 conditions, got %d", len(got))
	}

	// SetConditions replaces previous rows.
	if err := ruleStore.SetConditions(ctx, r.ID, []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 95, Enabled: true},
	}); err != nil {
		t.Fatalf("SetConditions: %v", err)
	}
	got, _ = ruleStore.ConditionsByRule(ctx, r.ID)
	if len(got) != 1 || got[0].Level != "critical" || got[0].Value != 95 {
		t.Fatalf("after SetConditions want [critical=95], got %+v", got)
	}
}

func TestAlertRuleStore_DerivativeRoundTrip(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()
	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:       "org5",
		Name:        "net bps",
		Measurement: "net",
		Field:       "bytes_recv",
		Derivative: &cloudhub.DerivativeConfig{
			Enabled:     true,
			NonNegative: true,
			Unit:        "1s",
		},
		Active: true,
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	got, err := ruleStore.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Derivative == nil || !got.Derivative.Enabled || !got.Derivative.NonNegative || got.Derivative.Unit != "1s" {
		t.Fatalf("Derivative not hydrated: %+v", got.Derivative)
	}

	// Disable via Update — Derivative=nil should clear the persisted flag.
	got.Derivative = nil
	if err := ruleStore.Update(ctx, got); err != nil {
		t.Fatalf("Update (disable): %v", err)
	}
	got, _ = ruleStore.Get(ctx, r.ID)
	if got.Derivative != nil {
		t.Fatalf("expected Derivative=nil after disable, got %+v", got.Derivative)
	}
}

func TestAlertRuleStore_EvalRoundTrip(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()
	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:       "org6",
		Name:        "disk inode",
		Measurement: "disk",
		Field:       "inodes_used",
		Eval: &cloudhub.EvalConfig{
			Expression: `float("inodes_used") / float("inodes_total") * 100.0`,
			As:         "inodes_used_percent",
		},
		Active: true,
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	got, err := ruleStore.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Eval == nil || got.Eval.Expression == "" || got.Eval.As != "inodes_used_percent" {
		t.Fatalf("Eval not hydrated: %+v", got.Eval)
	}

	// Empty pair (expression or as) means inactive — Update must clear.
	got.Eval = &cloudhub.EvalConfig{Expression: "", As: "foo"}
	if err := ruleStore.Update(ctx, got); err != nil {
		t.Fatalf("Update (clear via empty expression): %v", err)
	}
	got, _ = ruleStore.Get(ctx, r.ID)
	if got.Eval != nil {
		t.Fatalf("expected Eval=nil after clearing, got %+v", got.Eval)
	}
}

func TestAlertRuleStore_DerivativeAndEvalCoexist(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()
	ruleStore := pgsql.NewAlertRuleStore(client)
	ctx := context.Background()

	r, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:       "org7",
		Name:        "mixed",
		Measurement: "disk",
		Field:       "inodes_used",
		Eval: &cloudhub.EvalConfig{
			Expression: `float("inodes_used") / float("inodes_total") * 100.0`,
			As:         "inodes_used_percent",
		},
		Derivative: &cloudhub.DerivativeConfig{Enabled: true, NonNegative: true, Unit: "10s"},
		Active:     true,
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	got, err := ruleStore.Get(ctx, r.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Derivative == nil || got.Derivative.Unit != "10s" {
		t.Fatalf("Derivative not hydrated alongside Eval: %+v", got.Derivative)
	}
	if got.Eval == nil || got.Eval.As != "inodes_used_percent" {
		t.Fatalf("Eval not hydrated alongside Derivative: %+v", got.Eval)
	}
}
