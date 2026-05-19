package builtin

import (
	"context"
	"errors"
	"testing"

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
		got[tmpl.ID] = true
	}
	for _, id := range expectedBuiltinTemplateIDs {
		if !got[id] {
			t.Errorf("missing builtin template: %s", id)
		}
	}
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
