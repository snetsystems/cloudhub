package pgsql_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestAlertKapacitorMappingStore_PutGetDelete(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	kapStore := pgsql.NewAlertKapacitorStore(client)
	mappingStore := pgsql.NewAlertKapacitorMappingStore(client)
	ctx := context.Background()

	alertKapa, err := kapStore.Add(ctx, cloudhub.AlertKapacitor{
		OrgID: "org-1",
		Name:  "kap-1",
		URL:   "http://kapacitor.example:9092",
	})
	if err != nil {
		t.Fatalf("Add alert kapacitor: %v", err)
	}

	if err := mappingStore.Put(ctx, 10, 20, alertKapa.ID); err != nil {
		t.Fatalf("Put: %v", err)
	}

	gotID, err := mappingStore.GetAlertKapacitorID(ctx, 10, 20)
	if err != nil {
		t.Fatalf("GetAlertKapacitorID: %v", err)
	}
	if gotID != alertKapa.ID {
		t.Fatalf("mapped ID = %q, want %q", gotID, alertKapa.ID)
	}

	if err := mappingStore.Delete(ctx, 10, 20); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := mappingStore.GetAlertKapacitorID(ctx, 10, 20); err == nil {
		t.Fatal("expected error after delete")
	}
}
