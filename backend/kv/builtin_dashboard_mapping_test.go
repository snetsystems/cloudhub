package kv_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestBuiltinDashboardMappingStore_RegisterAndGet(t *testing.T) {
	client, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()

	ctx := context.Background()
	mapping := client.BuiltinDashboardMappingStore()

	orgID := "org-1"
	name := "host_page"
	dashboardID := cloudhub.DashboardID(42)

	if err := mapping.Register(ctx, orgID, name, dashboardID); err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	got, err := mapping.GetDashboardID(ctx, orgID, name)
	if err != nil {
		t.Fatalf("GetDashboardID() error = %v", err)
	}
	if got != dashboardID {
		t.Errorf("GetDashboardID() = %v, want %v", got, dashboardID)
	}
}

func TestBuiltinDashboardMappingStore_GetDashboardID_NotFound(t *testing.T) {
	client, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()

	ctx := context.Background()
	mapping := client.BuiltinDashboardMappingStore()

	_, err = mapping.GetDashboardID(ctx, "org-1", "nonexistent")
	if err != cloudhub.ErrDashboardNotFound {
		t.Errorf("GetDashboardID() error = %v, want ErrDashboardNotFound", err)
	}
}

func TestBuiltinDashboardMappingStore_ListByBuiltinName(t *testing.T) {
	client, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()

	ctx := context.Background()
	mapping := client.BuiltinDashboardMappingStore()

	if err := mapping.Register(ctx, "org-1", "host_page", 10); err != nil {
		t.Fatalf("Register(org-1) error = %v", err)
	}
	if err := mapping.Register(ctx, "org-2", "host_page", 20); err != nil {
		t.Fatalf("Register(org-2) error = %v", err)
	}
	if err := mapping.Register(ctx, "org-1", "other_page", 30); err != nil {
		t.Fatalf("Register(org-1, other_page) error = %v", err)
	}

	entries, err := mapping.ListByBuiltinName(ctx, "host_page")
	if err != nil {
		t.Fatalf("ListByBuiltinName() error = %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("ListByBuiltinName() returned %d entries, want 2", len(entries))
	}
	byOrg := make(map[string]cloudhub.DashboardID)
	for _, e := range entries {
		byOrg[e.OrgID] = e.DashboardID
	}
	if byOrg["org-1"] != 10 || byOrg["org-2"] != 20 {
		t.Errorf("ListByBuiltinName() entries = %+v", entries)
	}

	other, err := mapping.ListByBuiltinName(ctx, "other_page")
	if err != nil {
		t.Fatalf("ListByBuiltinName(other_page) error = %v", err)
	}
	if len(other) != 1 || other[0].OrgID != "org-1" || other[0].DashboardID != 30 {
		t.Errorf("ListByBuiltinName(other_page) = %+v", other)
	}

	empty, err := mapping.ListByBuiltinName(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("ListByBuiltinName(nonexistent) error = %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("ListByBuiltinName(nonexistent) = %+v, want empty", empty)
	}
}
