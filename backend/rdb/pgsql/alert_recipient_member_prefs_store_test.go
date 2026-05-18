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
