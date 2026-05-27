package pgsql_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	kapackage "github.com/snetsystems/cloudhub/backend/kapacitor"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

// TestAlertGroupRule_TickscriptE2E exercises the full pipeline against the
// live dev databases:
//
//  1. Seed alert_kapacitors, recipient_groups, recipient_group_members,
//     alert_recipient_member_prefs, alert_rules, alert_rule_conditions, and
//     alert_rule_recipient_groups rows.
//  2. Reload the rule via the store (verifies hydration of Conditions /
//     Hostnames / RecipientGroupIDs).
//  3. Build the AlertRecipients via kapackage.ResolveAlertRecipients.
//  4. Generate the TICKscript via kapackage.AlertGroupRuleTICKScript.
//  5. Deploy the script to live Kapacitor (PATCH-then-POST fallback).
//  6. Verify Kapacitor returns the same script with status=enabled.
//  7. Tear down the Kapacitor task.
//
// Gates: requires both TEST_PGSQL_DSN and TEST_KAPACITOR_URL env vars.
func TestAlertGroupRule_TickscriptE2E(t *testing.T) {
	kapaURL := strings.TrimRight(os.Getenv("TEST_KAPACITOR_URL"), "/")
	if kapaURL == "" {
		t.Skip("TEST_KAPACITOR_URL not set")
	}

	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	ctx := context.Background()
	rgStore := pgsql.NewRecipientGroupStore(client)
	prefsStore := pgsql.NewAlertRecipientMemberPrefsStore(client)
	ruleStore := pgsql.NewAlertRuleStore(client)
	kapaStore := pgsql.NewAlertKapacitorStore(client)

	orgID := "org-e2e"

	// 1. Seed AlertKapacitor row for FK satisfaction on the alert_rule.
	kapa, err := kapaStore.Add(ctx, cloudhub.AlertKapacitor{
		OrgID: orgID,
		Name:  "e2e-kapacitor",
		URL:   kapaURL,
	})
	if err != nil {
		t.Fatalf("AlertKapacitor.Add: %v", err)
	}

	// 2. Seed RecipientGroup + 3 members with different EmailLevels.
	g, err := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: orgID, Name: "DevOps E2E"})
	if err != nil {
		t.Fatalf("RecipientGroup.Add: %v", err)
	}
	mAll, _ := rgStore.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u-all", UserName: "All", Email: "all@e2e.example",
	})
	mWarn, _ := rgStore.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u-warn", UserName: "Warn", Email: "warn@e2e.example",
	})
	mCrit, _ := rgStore.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u-crit", UserName: "Crit", Email: "crit@e2e.example",
	})

	// 3. Per-member alert prefs.
	mustUpsertPrefs(t, ctx, prefsStore, cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: mAll.ID, EmailEnabled: true, EmailLevel: "all",
	})
	mustUpsertPrefs(t, ctx, prefsStore, cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: mWarn.ID, EmailEnabled: true, EmailLevel: "warning",
	})
	mustUpsertPrefs(t, ctx, prefsStore, cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: mCrit.ID, EmailEnabled: true, EmailLevel: "critical",
	})

	// 4. AlertGroupRule + conditions + recipient group + host.
	rule, err := ruleStore.Add(ctx, cloudhub.AlertGroupRule{
		OrgID:           orgID,
		KapacitorID:     kapa.ID,
		Name:            "cpu-e2e",
		Database:        "telegraf",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_user",
		TaskType:        "stream",
		Every:           "10s",
		OccurrenceType:  "consecutive",
		OccurrenceCount: 1,
		Message:         "CPU high on {{ index .Tags \"host\" }}",
		Active:          true,
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "warning", Value: 70, Enabled: true},
			{Level: "critical", Value: 90, Enabled: true},
		},
	})
	if err != nil {
		t.Fatalf("AlertRule.Add: %v", err)
	}

	if err := ruleStore.SetRecipientGroups(ctx, rule.ID, []string{g.ID}); err != nil {
		t.Fatalf("SetRecipientGroups: %v", err)
	}
	if err := ruleStore.SetHosts(ctx, rule.ID, []string{"e2e-host-01"}); err != nil {
		t.Fatalf("SetHosts: %v", err)
	}

	// 5. Reload the rule (verifies hydration).
	full, err := ruleStore.Get(ctx, rule.ID)
	if err != nil {
		t.Fatalf("AlertRule.Get: %v", err)
	}
	if len(full.Conditions) != 2 {
		t.Fatalf("expected 2 conditions hydrated, got %d", len(full.Conditions))
	}
	if len(full.RecipientGroupIDs) != 1 || full.RecipientGroupIDs[0] != g.ID {
		t.Fatalf("expected RecipientGroupIDs=[%s], got %+v", g.ID, full.RecipientGroupIDs)
	}
	if len(full.Hostnames) != 1 || full.Hostnames[0] != "e2e-host-01" {
		t.Fatalf("expected Hostnames=[e2e-host-01], got %+v", full.Hostnames)
	}

	// 6. Build the prefs map.
	groups, err := ruleStore.RecipientGroupsByRule(ctx, full.ID)
	if err != nil {
		t.Fatalf("RecipientGroupsByRule: %v", err)
	}
	prefs := map[string]cloudhub.AlertRecipientMemberPrefs{}
	for _, gg := range groups {
		for _, m := range gg.Members {
			p, err := prefsStore.Get(ctx, m.ID)
			if err == nil {
				prefs[m.ID] = p
			}
		}
	}

	// 7. Resolve recipients + generate tickscript.
	recipients := kapackage.ResolveAlertRecipients(full, groups, prefs)
	tick, err := kapackage.AlertGroupRuleTICKScript(full, recipients, full.Hostnames)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}

	// Verify the script body contains the expected pieces.
	expectSubstrings := []string{
		`"usage_user" > 70`,
		`"usage_user" > 90`,
		`all@e2e.example`,
		`warn@e2e.example`,
		`crit@e2e.example`,
		`"host" == 'e2e-host-01'`,
	}
	for _, sub := range expectSubstrings {
		if !strings.Contains(tick, sub) {
			t.Fatalf("tickscript missing %q\n----\n%s\n----", sub, tick)
		}
	}

	// 8. Deploy to Kapacitor (PATCH-or-POST). Always cleanup the task after.
	taskID := "alert-group-" + full.ID
	t.Cleanup(func() {
		req, _ := http.NewRequest(http.MethodDelete, kapaURL+"/kapacitor/v1/tasks/"+taskID, nil)
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	})

	body := map[string]interface{}{
		"id":     taskID,
		"type":   "stream",
		"dbrps":  []map[string]string{{"db": full.Database, "rp": full.RetentionPolicy}},
		"script": tick,
		"status": "enabled",
	}
	if err := patchOrCreateKapacitorTask(kapaURL, taskID, body); err != nil {
		t.Fatalf("deploy to Kapacitor: %v", err)
	}

	// 9. Verify Kapacitor stored the task.
	resp, err := http.Get(kapaURL + "/kapacitor/v1/tasks/" + taskID)
	if err != nil {
		t.Fatalf("GET kapacitor task: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("GET kapacitor task: status=%d body=%s", resp.StatusCode, raw)
	}
	var got struct {
		ID     string `json:"id"`
		Status string `json:"status"`
		Script string `json:"script"`
		Error  string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode kapacitor task: %v", err)
	}
	if got.ID != taskID {
		t.Fatalf("kapacitor task id mismatch: want=%s got=%s", taskID, got.ID)
	}
	if got.Status != "enabled" {
		t.Fatalf("kapacitor task status: want=enabled got=%s (error=%s)", got.Status, got.Error)
	}
	if got.Error != "" {
		t.Fatalf("kapacitor reported task error: %s", got.Error)
	}
	if !strings.Contains(got.Script, `"usage_user" > 90`) {
		t.Fatalf("kapacitor-stored script missing condition\n----\n%s\n----", got.Script)
	}

	t.Logf("tickscript deployed and verified: task=%s recipients=info:%d warn:%d crit:%d",
		taskID, len(recipients.Info), len(recipients.Warn), len(recipients.Crit))
}

func mustUpsertPrefs(t *testing.T, ctx context.Context, s cloudhub.AlertRecipientMemberPrefsStore, p cloudhub.AlertRecipientMemberPrefs) {
	t.Helper()
	if err := s.Upsert(ctx, p); err != nil {
		t.Fatalf("AlertRecipientMemberPrefs.Upsert: %v", err)
	}
}

func patchOrCreateKapacitorTask(kapaURL, taskID string, body map[string]interface{}) error {
	data, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPatch, kapaURL+"/kapacitor/v1/tasks/"+taskID, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		cresp, err := http.Post(kapaURL+"/kapacitor/v1/tasks", "application/json", bytes.NewReader(data))
		if err != nil {
			return err
		}
		defer cresp.Body.Close()
		if cresp.StatusCode >= 400 {
			raw, _ := io.ReadAll(cresp.Body)
			return parseKapaErr(cresp.StatusCode, raw)
		}
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return parseKapaErr(resp.StatusCode, raw)
	}
	return nil
}

func parseKapaErr(status int, body []byte) error {
	var e struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal(body, &e)
	if e.Error != "" {
		return &kapaErr{Status: status, Msg: e.Error}
	}
	return &kapaErr{Status: status, Msg: string(body)}
}

type kapaErr struct {
	Status int
	Msg    string
}

func (e *kapaErr) Error() string { return e.Msg }
