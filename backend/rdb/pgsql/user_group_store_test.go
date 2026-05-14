package pgsql_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestUserGroupStore_AddAndGet(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	store := pgsql.NewUserGroupStore(client)
	ctx := context.Background()

	nodes := cloudhub.AlertNodes{
		Slack: []*cloudhub.Slack{{Channel: "#alerts", Workspace: "myteam"}},
	}
	g, err := store.Add(ctx, cloudhub.UserGroup{
		OrgID:         "org1",
		Name:          "ops-team",
		AlertNodes:    nodes,
		ReceiveLevel:  "all",
		NotifyDays:    "1,2,3,4,5",
		NotifyStartHM: "09:00",
		NotifyEndHM:   "18:00",
	})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	if g.ID == "" {
		t.Fatal("expected non-empty ID")
	}

	got, err := store.Get(ctx, g.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != "ops-team" {
		t.Errorf("Name = %q, want %q", got.Name, "ops-team")
	}
	if len(got.AlertNodes.Slack) == 0 {
		t.Error("expected Slack AlertNodes to be preserved")
	}
	if got.AlertNodes.Slack[0].Channel != "#alerts" {
		t.Errorf("Slack channel = %q, want %q", got.AlertNodes.Slack[0].Channel, "#alerts")
	}
}
