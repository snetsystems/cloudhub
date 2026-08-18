package repair

import (
	"errors"
	"testing"
	"time"
)

func TestPlanStoreExpiresPlansAfterTTL(t *testing.T) {
	now := time.Date(2026, 8, 14, 3, 0, 0, 0, time.UTC)
	store := NewPlanStore(2*time.Minute, func() time.Time { return now })

	created := store.Create(Plan{
		Namespace:       "network-repair-demo",
		PolicyName:      "allow-frontend-to-backend",
		CurrentPort:     8081,
		DesiredPort:     8080,
		ResourceVersion: "rv-policy-1",
	})
	if created.ID == "" {
		t.Fatal("Create() returned an empty plan ID")
	}
	if !created.ExpiresAt.Equal(now.Add(2 * time.Minute)) {
		t.Fatalf("ExpiresAt = %s", created.ExpiresAt)
	}
	if _, err := store.Get(created.ID); err != nil {
		t.Fatalf("Get() before expiry: %v", err)
	}

	now = now.Add(2 * time.Minute)
	if _, err := store.Get(created.ID); !errors.Is(err, ErrPlanExpired) {
		t.Fatalf("Get() at expiry error = %v, want ErrPlanExpired", err)
	}
}

func TestPlanStoreReplaysOnlyCompletedResultForSameKey(t *testing.T) {
	now := time.Date(2026, 8, 14, 3, 0, 0, 0, time.UTC)
	store := NewPlanStore(2*time.Minute, func() time.Time { return now })
	created := store.Create(Plan{
		Namespace:       "network-repair-demo",
		PolicyName:      "allow-frontend-to-backend",
		CurrentPort:     8081,
		DesiredPort:     8080,
		ResourceVersion: "rv-policy-1",
	})

	started, previous, err := store.BeginApply(created.ID, "apply-key-1")
	if err != nil {
		t.Fatal(err)
	}
	if previous != nil {
		t.Fatalf("first BeginApply() result = %#v", previous)
	}
	if started.ID != created.ID {
		t.Fatalf("started plan ID = %q", started.ID)
	}
	if _, _, err := store.BeginApply(created.ID, "apply-key-1"); !errors.Is(err, ErrPlanInProgress) {
		t.Fatalf("second BeginApply() error = %v, want ErrPlanInProgress", err)
	}

	wantResult := ApplyResult{
		PlanID:          created.ID,
		Namespace:       created.Namespace,
		PolicyName:      created.PolicyName,
		PreviousPort:    8081,
		CurrentPort:     8080,
		ResourceVersion: "rv-policy-2",
	}
	if err := store.FinishApply(created.ID, "apply-key-1", wantResult); err != nil {
		t.Fatal(err)
	}

	_, replay, err := store.BeginApply(created.ID, "apply-key-1")
	if err != nil {
		t.Fatal(err)
	}
	if replay == nil || *replay != wantResult {
		t.Fatalf("replayed result = %#v, want %#v", replay, wantResult)
	}
	if _, _, err := store.BeginApply(created.ID, "apply-key-2"); !errors.Is(err, ErrPlanUsed) {
		t.Fatalf("different-key BeginApply() error = %v, want ErrPlanUsed", err)
	}
}

func TestPlanStoreReturnsDefensiveCopies(t *testing.T) {
	now := time.Date(2026, 8, 14, 3, 0, 0, 0, time.UTC)
	store := NewPlanStore(2*time.Minute, func() time.Time { return now })
	created := store.Create(Plan{
		Namespace:       "network-repair-demo",
		PolicyName:      "allow-frontend-to-backend",
		CurrentPort:     8081,
		DesiredPort:     8080,
		ResourceVersion: "rv-policy-1",
	})
	_, _, err := store.BeginApply(created.ID, "apply-key-1")
	if err != nil {
		t.Fatal(err)
	}
	result := ApplyResult{PlanID: created.ID, CurrentPort: 8080}
	if err := store.FinishApply(created.ID, "apply-key-1", result); err != nil {
		t.Fatal(err)
	}

	first, err := store.Get(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	first.PolicyName = "mutated"
	first.Result.CurrentPort = 9999

	second, err := store.Get(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if second.PolicyName != "allow-frontend-to-backend" {
		t.Fatalf("stored PolicyName = %q", second.PolicyName)
	}
	if second.Result == nil || second.Result.CurrentPort != 8080 {
		t.Fatalf("stored Result = %#v", second.Result)
	}
}

func TestPlanStoreRejectsUnknownPlan(t *testing.T) {
	store := NewPlanStore(time.Minute, time.Now)
	if _, err := store.Get("missing"); !errors.Is(err, ErrPlanNotFound) {
		t.Fatalf("Get() error = %v, want ErrPlanNotFound", err)
	}
}
