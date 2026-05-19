package pgsql_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestAlertRecipientMemberPrefsStore_RoundTrip(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()
	rgStore := pgsql.NewRecipientGroupStore(client)
	store := pgsql.NewAlertRecipientMemberPrefsStore(client)
	ctx := context.Background()

	g, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org1", Name: "G"})
	m, _ := rgStore.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u1", UserName: "John", Email: "j@x.com",
	})

	if err := store.Upsert(ctx, cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: m.ID,
		EmailEnabled:           true,
		EmailLevel:             "warning",
		SMSEnabled:             false,
		SMSLevel:               "all",
		NotifyWeekdays:         "1,2,3,4,5",
		NotifyStartHM:          "09:00",
		NotifyEndHM:            "18:00",
		EscalationSeconds:      0,
	}); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	got, err := store.Get(ctx, m.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.EmailLevel != "warning" || got.NotifyStartHM != "09:00" {
		t.Fatalf("unexpected prefs: %+v", got)
	}

	byGroup, err := store.ByGroup(ctx, g.ID)
	if err != nil {
		t.Fatalf("ByGroup: %v", err)
	}
	if len(byGroup) != 1 {
		t.Fatalf("ByGroup: want 1, got %d", len(byGroup))
	}
}

func TestAlertRecipientMemberPrefsStore_UpsertBulk(t *testing.T) {
	client, cleanup := setupAlertGroupTestDB(t)
	defer cleanup()
	rgStore := pgsql.NewRecipientGroupStore(client)
	store := pgsql.NewAlertRecipientMemberPrefsStore(client)
	ctx := context.Background()

	g, _ := rgStore.Add(ctx, cloudhub.RecipientGroup{OrgID: "org1", Name: "G"})
	m1, _ := rgStore.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u1", UserName: "Alice", Email: "a@x.com",
	})
	m2, _ := rgStore.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u2", UserName: "Bob", Email: "b@x.com",
	})
	m3, _ := rgStore.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: g.ID, UserID: "u3", UserName: "Carol", Email: "c@x.com",
	})

	// Seed m3 so we can verify the bulk call leaves untouched members alone.
	if err := store.Upsert(ctx, cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: m3.ID,
		EmailEnabled:           true,
		EmailLevel:             "critical",
	}); err != nil {
		t.Fatalf("seed Upsert: %v", err)
	}

	// Bulk only touches m1 + m2.
	if err := store.UpsertBulk(ctx, []cloudhub.AlertRecipientMemberPrefs{
		{RecipientGroupMemberID: m1.ID, EmailEnabled: true, EmailLevel: "warning"},
		{RecipientGroupMemberID: m2.ID, EmailEnabled: false, EmailLevel: "all", SMSEnabled: true, SMSLevel: "critical"},
	}); err != nil {
		t.Fatalf("UpsertBulk: %v", err)
	}

	byGroup, err := store.ByGroup(ctx, g.ID)
	if err != nil {
		t.Fatalf("ByGroup: %v", err)
	}
	if len(byGroup) != 3 {
		t.Fatalf("expected prefs for all 3 members, got %d", len(byGroup))
	}
	byID := map[string]cloudhub.AlertRecipientMemberPrefs{}
	for _, p := range byGroup {
		byID[p.RecipientGroupMemberID] = p
	}
	if got := byID[m1.ID]; got.EmailLevel != "warning" || !got.EmailEnabled {
		t.Errorf("m1 prefs not applied: %+v", got)
	}
	if got := byID[m2.ID]; got.EmailLevel != "all" || got.EmailEnabled || !got.SMSEnabled {
		t.Errorf("m2 prefs not applied: %+v", got)
	}
	if got := byID[m3.ID]; got.EmailLevel != "critical" || !got.EmailEnabled {
		t.Errorf("m3 prefs should be unchanged: %+v", got)
	}

	// Empty slice is a no-op.
	if err := store.UpsertBulk(ctx, nil); err != nil {
		t.Errorf("UpsertBulk(nil): %v", err)
	}
}
