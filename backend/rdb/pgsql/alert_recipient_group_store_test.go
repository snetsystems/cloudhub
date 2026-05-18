package pgsql_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestAlertRecipientGroupStore_UpsertGet(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	rgStore := pgsql.NewRecipientGroupStore(client)
	store := pgsql.NewAlertRecipientGroupStore(client)
	ctx := context.Background()

	g, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org1", Name: "DevOps"})

	if err := store.Upsert(ctx, cloudhub.AlertRecipientGroup{
		RecipientGroupID: g.ID, SuppressionEnabled: true,
		SuppressionWindowSeconds: 60, SuppressionCount: 5, SuppressionPauseSeconds: 120,
	}); err != nil {
		t.Fatalf("Upsert insert: %v", err)
	}

	got, err := store.Get(ctx, g.ID)
	if err != nil || !got.SuppressionEnabled || got.SuppressionCount != 5 {
		t.Fatalf("Get after Upsert: %+v err=%v", got, err)
	}

	// Second Upsert acts as Update.
	if err := store.Upsert(ctx, cloudhub.AlertRecipientGroup{
		RecipientGroupID: g.ID, SuppressionEnabled: false,
		SuppressionWindowSeconds: 60, SuppressionCount: 99, SuppressionPauseSeconds: 120,
	}); err != nil {
		t.Fatalf("Upsert update: %v", err)
	}
	got2, _ := store.Get(ctx, g.ID)
	if got2.SuppressionCount != 99 || got2.SuppressionEnabled {
		t.Fatalf("Upsert did not update existing row: %+v", got2)
	}

	if err := store.Delete(ctx, g.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := store.Get(ctx, g.ID); err == nil {
		t.Fatal("expected Get to fail after Delete")
	}
}
