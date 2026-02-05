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
