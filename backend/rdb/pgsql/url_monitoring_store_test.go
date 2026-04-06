package pgsql_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestURLMonitoringStore_AddGetDelete(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := pgsql.NewURLMonitoringStore(client)
	ctx := context.Background()

	m := &cloudhub.URLMonitoring{
		OrgID:           "org-test-1",
		CollectorServer: "collector-01",
		Targets: []cloudhub.URLMonitoringTarget{
			{Name: "Service A", URL: "https://service-a.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
			{Name: "Service B", URL: "https://service-b.com", Interval: "2m", ResponseTimeout: "10s", Method: "POST"},
		},
	}

	// Add
	created, err := store.Add(ctx, m)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected non-empty ID")
	}
	if len(created.Targets) != 2 {
		t.Fatalf("expected 2 targets, got %d", len(created.Targets))
	}

	// Get
	got, err := store.Get(ctx, "org-test-1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.CollectorServer != "collector-01" {
		t.Errorf("CollectorServer: got %q, want %q", got.CollectorServer, "collector-01")
	}
	if len(got.Targets) != 2 {
		t.Fatalf("expected 2 targets, got %d", len(got.Targets))
	}
	if got.Targets[1].ResponseTimeout != "10s" {
		t.Errorf("target ResponseTimeout: got %q, want 10s", got.Targets[1].ResponseTimeout)
	}
	if got.Targets[1].Method != "POST" {
		t.Errorf("target Method: got %q, want POST", got.Targets[1].Method)
	}

	// GetByID
	byID, err := store.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if byID.OrgID != "org-test-1" {
		t.Errorf("GetByID OrgID: got %q, want org-test-1", byID.OrgID)
	}

	// Delete (cascade soft-delete targets in same transaction)
	if err := store.Delete(ctx, created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = store.Get(ctx, "org-test-1")
	if err != cloudhub.ErrURLMonitoringNotFound {
		t.Fatalf("expected ErrURLMonitoringNotFound, got %v", err)
	}

	var activeTargets int
	row := client.QueryRowContext(ctx,
		`SELECT count(*)::int FROM url_check_targets WHERE url_check_id = $1 AND delete_yn = false`,
		created.ID,
	)
	if err := row.Scan(&activeTargets); err != nil {
		t.Fatalf("count targets after delete: %v", err)
	}
	if activeTargets != 0 {
		t.Fatalf("expected 0 active targets after parent delete, got %d", activeTargets)
	}
}

func TestURLMonitoringStore_Update(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := pgsql.NewURLMonitoringStore(client)
	ctx := context.Background()

	m := &cloudhub.URLMonitoring{
		OrgID:           "org-test-2",
		CollectorServer: "collector-01",
		Targets: []cloudhub.URLMonitoringTarget{
			{Name: "Old", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}
	created, err := store.Add(ctx, m)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}

	// Update: replace targets with new method/timeout
	created.Targets = []cloudhub.URLMonitoringTarget{
		{Name: "New A", URL: "https://new-a.com", Interval: "2m", ResponseTimeout: "10s", Method: "POST"},
		{Name: "New B", URL: "https://new-b.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
	}
	updated, err := store.Update(ctx, created)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if len(updated.Targets) != 2 {
		t.Fatalf("expected 2 targets after update, got %d", len(updated.Targets))
	}
	if updated.Targets[0].Method != "POST" {
		t.Errorf("target Method: got %q, want POST", updated.Targets[0].Method)
	}
}

// Update with client-supplied target ids: only removed rows are soft-deleted; existing rows are updated in place.
func TestURLMonitoringStore_UpdateIncrementalByTargetID(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := pgsql.NewURLMonitoringStore(client)
	ctx := context.Background()

	created, err := store.Add(ctx, &cloudhub.URLMonitoring{
		OrgID: "org-incr-1", CollectorServer: "c1",
		Targets: []cloudhub.URLMonitoringTarget{
			{Name: "A", URL: "https://a.example", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
			{Name: "B", URL: "https://b.example", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	if len(created.Targets) != 2 {
		t.Fatalf("expected 2 targets from Add, got %d", len(created.Targets))
	}
	idA, idB := created.Targets[0].ID, created.Targets[1].ID

	// Keep both ids: change URL of A, drop B, add C.
	created.Targets = []cloudhub.URLMonitoringTarget{
		{ID: idA, Name: "A2", URL: "https://a2.example", Interval: "2m", ResponseTimeout: "5s", Method: "GET"},
		{Name: "C", URL: "https://c.example", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
	}
	updated, err := store.Update(ctx, created)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if len(updated.Targets) != 2 {
		t.Fatalf("expected 2 targets after update, got %d", len(updated.Targets))
	}

	byID, err := store.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if len(byID.Targets) != 2 {
		t.Fatalf("GetByID: expected 2 active targets, got %d", len(byID.Targets))
	}
	var seenA, seenC bool
	for _, tg := range byID.Targets {
		switch tg.ID {
		case idA:
			seenA = true
			if tg.URL != "https://a2.example" || tg.Name != "A2" || tg.Interval != "2m" {
				t.Errorf("target A fields: %+v", tg)
			}
		default:
			if tg.URL == "https://c.example" {
				seenC = true
				if tg.ID == "" {
					t.Error("new target C should have assigned id")
				}
			}
		}
	}
	if !seenA {
		t.Error("expected to keep and update target A by id")
	}
	if !seenC {
		t.Error("expected new target C")
	}
	for _, tg := range byID.Targets {
		if tg.ID == idB {
			t.Errorf("removed target B id %s should not appear active", idB)
		}
	}
}

func TestURLMonitoringStore_All(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := pgsql.NewURLMonitoringStore(client)
	ctx := context.Background()

	for _, orgID := range []string{"org-all-1", "org-all-2"} {
		_, err := store.Add(ctx, &cloudhub.URLMonitoring{
			OrgID: orgID, CollectorServer: "c1",
		})
		if err != nil {
			t.Fatalf("Add %s: %v", orgID, err)
		}
	}

	all, err := store.All(ctx)
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(all) < 2 {
		t.Fatalf("expected at least 2, got %d", len(all))
	}
}
