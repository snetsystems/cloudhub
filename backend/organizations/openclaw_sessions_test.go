package organizations_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

func TestOpenClawSessionStoreUpdateTitle(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "1")
	inner := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			return &cloudhub.OpenClawSession{ID: id, OrganizationID: "1"}, nil
		},
		UpdateTitleF: func(_ context.Context, id, title string) error {
			if id != "session-1" || title != "WAS 서버 점검" {
				t.Fatalf("UpdateTitle(%q, %q)", id, title)
			}
			return nil
		},
	}
	store := organizations.NewOpenClawSessionStore(inner, "1")
	if err := store.UpdateTitle(ctx, "session-1", "WAS 서버 점검"); err != nil {
		t.Fatalf("UpdateTitle: %v", err)
	}
}

func TestOpenClawSessionStoreUpdateTitleOtherOrganization(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "1")
	inner := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			return &cloudhub.OpenClawSession{ID: id, OrganizationID: "2"}, nil
		},
		UpdateTitleF: func(context.Context, string, string) error {
			t.Fatal("UpdateTitle reached the inner store for another organization")
			return nil
		},
	}
	store := organizations.NewOpenClawSessionStore(inner, "1")
	if err := store.UpdateTitle(ctx, "session-1", "제목"); err == nil {
		t.Fatal("UpdateTitle across organizations should fail")
	}
}
