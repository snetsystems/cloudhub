package server

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/snetsystems/cloudhub/backend/openclaw"
)

func TestOpenClawManagedApprovalStoreCreateIsIdempotent(t *testing.T) {
	now := time.Date(2026, 8, 14, 8, 0, 0, 0, time.UTC)
	store := newOpenClawManagedApprovalStore(func() time.Time { return now })
	request := openClawManagedApprovalCreate{
		SessionKey: "agent:main:cloudhub:org:42:session-id", ToolName: "k8s_network__apply_network_policy_repair",
		ToolCallID: "tool-call-1", IdempotencyKey: "repair-1", Title: "NetworkPolicy 복구 승인",
		Description: "network-repair-demo/policy TCP 8081 → 8080", Severity: "warning", Timeout: 2 * time.Minute,
	}

	first, created, err := store.Create(request)
	if err != nil || !created {
		t.Fatalf("first Create() = (%#v, %t, %v), want new record", first, created, err)
	}
	second, created, err := store.Create(request)
	if err != nil || created {
		t.Fatalf("second Create() = (%#v, %t, %v), want existing record", second, created, err)
	}
	if first.ID != second.ID || first.State != openClawManagedApprovalPending {
		t.Fatalf("duplicate records = %#v and %#v", first, second)
	}
	if first.CreatedAtMs != now.UnixMilli() || first.ExpiresAtMs != now.Add(2*time.Minute).UnixMilli() {
		t.Fatalf("record timestamps = (%d, %d)", first.CreatedAtMs, first.ExpiresAtMs)
	}
}

func TestOpenClawManagedApprovalStoreResolveHasSingleWinner(t *testing.T) {
	now := time.Date(2026, 8, 14, 8, 0, 0, 0, time.UTC)
	store := newOpenClawManagedApprovalStore(func() time.Time { return now })
	record := mustCreateManagedApproval(t, store, "session-owned", "tool-call-1")

	start := make(chan struct{})
	results := make(chan error, 2)
	var wait sync.WaitGroup
	for _, decision := range []openclaw.PluginApprovalDecision{openclaw.DecisionAllowOnce, openclaw.DecisionDeny} {
		wait.Add(1)
		go func(decision openclaw.PluginApprovalDecision) {
			defer wait.Done()
			<-start
			_, err := store.Resolve(record.ID, "session-owned", decision)
			results <- err
		}(decision)
	}
	close(start)
	wait.Wait()
	close(results)

	var successes, conflicts int
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, errOpenClawManagedApprovalConflict):
			conflicts++
		default:
			t.Fatalf("Resolve() error = %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("Resolve() results = %d successes, %d conflicts", successes, conflicts)
	}
}

func TestOpenClawManagedApprovalStoreExpiresPendingRecords(t *testing.T) {
	now := time.Date(2026, 8, 14, 8, 0, 0, 0, time.UTC)
	store := newOpenClawManagedApprovalStore(func() time.Time { return now })
	record := mustCreateManagedApproval(t, store, "session-owned", "tool-call-1")

	now = now.Add(2 * time.Minute)
	got, err := store.Get(record.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got.State != openClawManagedApprovalExpired {
		t.Fatalf("Get().State = %q, want expired", got.State)
	}
	if pending := store.ListPending("session-owned"); len(pending) != 0 {
		t.Fatalf("ListPending() = %#v, want empty", pending)
	}
}

func TestOpenClawManagedApprovalStoreListsOnlyMatchingPendingSession(t *testing.T) {
	now := time.Date(2026, 8, 14, 8, 0, 0, 0, time.UTC)
	store := newOpenClawManagedApprovalStore(func() time.Time { return now })
	owned := mustCreateManagedApproval(t, store, "session-owned", "tool-call-owned")
	_ = mustCreateManagedApproval(t, store, "session-other", "tool-call-other")

	pending := store.ListPending("session-owned")
	if len(pending) != 1 || pending[0].ID != owned.ID {
		t.Fatalf("ListPending() = %#v, want only %q", pending, owned.ID)
	}
}

func TestOpenClawManagedApprovalStorePrunesTerminalRecords(t *testing.T) {
	now := time.Date(2026, 8, 14, 8, 0, 0, 0, time.UTC)
	store := newOpenClawManagedApprovalStore(func() time.Time { return now })
	record := mustCreateManagedApproval(t, store, "session-owned", "tool-call-1")
	if _, err := store.Resolve(record.ID, "session-owned", openclaw.DecisionAllowOnce); err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}

	now = now.Add(openClawManagedApprovalRetention + time.Millisecond)
	if _, err := store.Get(record.ID); !errors.Is(err, errOpenClawManagedApprovalNotFound) {
		t.Fatalf("Get() error = %v, want not found", err)
	}
}

func mustCreateManagedApproval(
	t *testing.T,
	store *openClawManagedApprovalStore,
	sessionKey string,
	toolCallID string,
) openClawManagedApproval {
	t.Helper()
	record, created, err := store.Create(openClawManagedApprovalCreate{
		SessionKey: sessionKey, ToolName: "k8s_network__apply_network_policy_repair",
		ToolCallID: toolCallID, IdempotencyKey: "repair-1", Title: "NetworkPolicy 복구 승인",
		Description: "network-repair-demo/policy TCP 8081 → 8080", Severity: "warning", Timeout: 2 * time.Minute,
	})
	if err != nil || !created {
		t.Fatalf("Create() = (%#v, %t, %v)", record, created, err)
	}
	return record
}
