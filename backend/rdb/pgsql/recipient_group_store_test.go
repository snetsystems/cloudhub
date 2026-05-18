package pgsql_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestRecipientGroupStore_AddGetAll(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	store := pgsql.NewRecipientGroupStore(client)
	ctx := context.Background()

	g, err := store.Add(ctx, cloudhub.RecipientGroup{OrgID: "org1", Name: "DevOps"})
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
	if got.Name != "DevOps" || got.OrgID != "org1" {
		t.Fatalf("unexpected fetched group: %+v", got)
	}

	list, err := store.All(ctx, "org1")
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("All: want 1 group, got %d", len(list))
	}
}

func TestRecipientGroupStore_SoftDelete(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	store := pgsql.NewRecipientGroupStore(client)
	ctx := context.Background()

	g, _ := store.Add(ctx, cloudhub.RecipientGroup{OrgID: "org1", Name: "TempGroup"})
	if err := store.Delete(ctx, g.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	list, _ := store.All(ctx, "org1")
	if len(list) != 0 {
		t.Fatalf("soft-deleted group should not appear in All, got %d", len(list))
	}
	// Get on a soft-deleted ID should fail (treated as not-found).
	if _, err := store.Get(ctx, g.ID); err == nil {
		t.Fatalf("expected Get to fail for soft-deleted row")
	}
}

func TestRecipientGroupStore_Members(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()

	store := pgsql.NewRecipientGroupStore(client)
	ctx := context.Background()
	g, _ := store.Add(ctx, cloudhub.RecipientGroup{OrgID: "org1", Name: "DevOps"})

	m1, err := store.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u1", UserName: "John",
		Email: "john@x.com", PhoneNumber: "010-1111",
	})
	if err != nil || m1.ID == "" {
		t.Fatalf("AddMember: %v %+v", err, m1)
	}

	members, err := store.Members(ctx, g.ID)
	if err != nil {
		t.Fatalf("Members: %v", err)
	}
	if len(members) != 1 || members[0].Email != "john@x.com" {
		t.Fatalf("unexpected members: %+v", members)
	}

	// Soft-delete the member, re-add the same user_id (allowed by partial unique index).
	if err := store.DeleteMember(ctx, m1.ID); err != nil {
		t.Fatalf("DeleteMember: %v", err)
	}
	if _, err := store.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u1", UserName: "John2",
		Email: "john2@x.com",
	}); err != nil {
		t.Fatalf("re-Add after soft-delete should succeed: %v", err)
	}
	active, _ := store.Members(ctx, g.ID)
	if len(active) != 1 || active[0].UserName != "John2" {
		t.Fatalf("expected only the re-added member active, got %+v", active)
	}
}
