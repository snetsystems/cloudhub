package builtin

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
	"text/template"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
)

// expectedBuiltinTemplateIDs lists every Phase 4 alert template. Updating this
// requires adding/removing the matching JSON file in backend/builtin/alerts/.
var expectedBuiltinTemplateIDs = []string{
	"agent_data_timeout",
	"cpu_steal",
	"cpu_usage",
	"disk_inode",
	"disk_io",
	"disk_usage",
	"mem_usage",
	"net_bps",
	"net_iops",
	"process_cpu",
	"process_mem",
	"swap_mem",
}

func TestBinAlertTemplatesStore_AllReturnsBuiltins(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	out, err := store.All(context.Background())
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(out) != len(expectedBuiltinTemplateIDs) {
		t.Fatalf("expected %d templates, got %d", len(expectedBuiltinTemplateIDs), len(out))
	}
	got := make(map[string]bool, len(out))
	for _, tmpl := range out {
		if tmpl.ID == "" || tmpl.Name == "" || tmpl.Measurement == "" {
			t.Errorf("template %+v missing required fields (id/name/measurement)", tmpl)
		}
		if tmpl.Category != "server-monitoring" {
			t.Errorf("template %s: expected category server-monitoring, got %q", tmpl.ID, tmpl.Category)
		}
		if tmpl.EmailBody == "" {
			t.Errorf("template %s: expected default emailBody", tmpl.ID)
		}
		got[tmpl.ID] = true
	}
	for _, id := range expectedBuiltinTemplateIDs {
		if !got[id] {
			t.Errorf("missing builtin template: %s", id)
		}
	}
}

// TestBinAlertTemplatesStore_DefaultEmailBodyLoadedFromAsset verifies that
// the default email body comes from the embedded HTML asset
// (alerts/_default_email_body.html) — not from a hardcoded Go string.
// Catches regressions if someone reintroduces inline HTML in bin.go.
func TestBinAlertTemplatesStore_DefaultEmailBodyLoadedFromAsset(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	out, err := store.All(context.Background())
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(out) == 0 {
		t.Fatal("no templates loaded")
	}
	body := out[0].EmailBody
	for _, marker := range []string{
		"<!doctype html>",
		"CloudHub Alert",
		"{{ .Level }}",
		`{{ index .Tags "host" }}`,
	} {
		if !strings.Contains(body, marker) {
			t.Errorf("default email body missing expected marker %q. Got:\n%s", marker, body)
		}
	}
}

func TestBinAlertTemplatesStore_DefaultEmailBodyColorsWarningAndCriticalDifferently(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	out, err := store.All(context.Background())
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(out) == 0 {
		t.Fatal("no templates loaded")
	}
	body := out[0].EmailBody
	for _, marker := range []string{
		`{{ if eq .Level "WARNING" }}`,
		"#fef3c7",
		"#92400e",
		`{{ else if eq .Level "CRITICAL" }}`,
		"#fee2e2",
		"#991b1b",
	} {
		if !strings.Contains(body, marker) {
			t.Errorf("default email body missing level color marker %q. Got:\n%s", marker, body)
		}
	}
}

func TestBinAlertTemplatesStore_DefaultEmailBodyRendersDistinctWarningAndCriticalColors(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	out, err := store.All(context.Background())
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(out) == 0 {
		t.Fatal("no templates loaded")
	}

	warning := renderDefaultEmailBody(t, out[0].EmailBody, "WARNING")
	if !strings.Contains(warning, "background:#fef3c7;color:#92400e") {
		t.Fatalf("warning email body should use amber badge colors:\n%s", warning)
	}
	if strings.Contains(warning, "background:#fee2e2;color:#991b1b") {
		t.Fatalf("warning email body must not use critical red badge colors:\n%s", warning)
	}
	if strings.Contains(warning, "{{") {
		t.Fatalf("warning email body still contains unrendered template syntax:\n%s", warning)
	}

	critical := renderDefaultEmailBody(t, out[0].EmailBody, "CRITICAL")
	if !strings.Contains(critical, "background:#fee2e2;color:#991b1b") {
		t.Fatalf("critical email body should use red badge colors:\n%s", critical)
	}
	if strings.Contains(critical, "background:#fef3c7;color:#92400e") {
		t.Fatalf("critical email body must not use warning amber badge colors:\n%s", critical)
	}
	if strings.Contains(critical, "{{") {
		t.Fatalf("critical email body still contains unrendered template syntax:\n%s", critical)
	}
}

func renderDefaultEmailBody(t *testing.T, body, level string) string {
	t.Helper()

	tmpl, err := template.New("default-email-body").Parse(body)
	if err != nil {
		t.Fatalf("parse default email body: %v", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, map[string]interface{}{
		"Level":   level,
		"Message": "example alert",
		"Time":    "2026-05-28T00:00:00Z",
		"ID":      "alert-group-example",
		"Tags": map[string]string{
			"host": "example-host-01",
		},
	}); err != nil {
		t.Fatalf("render default email body: %v", err)
	}
	return buf.String()
}

func TestBinAlertTemplatesStore_GetReturnsTemplate(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	tmpl, err := store.Get(context.Background(), "net_bps")
	if err != nil {
		t.Fatalf("Get(net_bps): %v", err)
	}
	if tmpl.ID != "net_bps" {
		t.Fatalf("expected id net_bps, got %q", tmpl.ID)
	}
	if tmpl.Derivative == nil || !tmpl.Derivative.Enabled || !tmpl.Derivative.NonNegative || tmpl.Derivative.Unit != "1s" {
		t.Fatalf("net_bps derivative not hydrated: %+v", tmpl.Derivative)
	}
}

func TestBinAlertTemplatesStore_DiskInodeUsesEval(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	tmpl, err := store.Get(context.Background(), "disk_inode")
	if err != nil {
		t.Fatalf("Get(disk_inode): %v", err)
	}
	if tmpl.Eval == nil || tmpl.Eval.As != "inodes_used_percent" {
		t.Fatalf("disk_inode eval not hydrated: %+v", tmpl.Eval)
	}
	if tmpl.Eval.Expression == "" {
		t.Fatalf("disk_inode eval expression empty")
	}
}

func TestBinAlertTemplatesStore_AgentDataTimeoutIsDeadman(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	tmpl, err := store.Get(context.Background(), "agent_data_timeout")
	if err != nil {
		t.Fatalf("Get(agent_data_timeout): %v", err)
	}
	if tmpl.Trigger != cloudhub.AlertGroupRuleTriggerDeadman {
		t.Fatalf("expected trigger=deadman, got %q", tmpl.Trigger)
	}
	if tmpl.TriggerValues.Period == "" {
		t.Fatalf("deadman template missing period: %+v", tmpl.TriggerValues)
	}
}

func TestBinAlertTemplatesStore_GetUnknownReturnsNotFound(t *testing.T) {
	t.Parallel()
	store := &BinAlertTemplatesStore{Logger: log.New(log.DebugLevel)}
	_, err := store.Get(context.Background(), "no-such-template")
	if !errors.Is(err, cloudhub.ErrAlertTemplateNotFound) {
		t.Fatalf("expected ErrAlertTemplateNotFound, got %v", err)
	}
}
