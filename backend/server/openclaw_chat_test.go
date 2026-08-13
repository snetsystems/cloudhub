package server

import (
	"context"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/noop"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

func TestOpenClawChatSessionStoreContract(t *testing.T) {
	ctx := context.Background()
	createdAt := time.Date(2026, time.August, 5, 12, 0, 0, 0, time.UTC)
	store := newOpenClawSessionStoreContract()
	if got := (&Store{OpenClawSessionStore: store}).OpenClawSessions(serverContext(ctx)); got != store {
		t.Fatal("server context must yield the configured OpenClaw session store")
	}
	orgCtx := context.WithValue(ctx, organizations.ContextKey, "org-a")
	if _, ok := (&Store{OpenClawSessionStore: store}).OpenClawSessions(orgCtx).(*organizations.OpenClawSessionStore); !ok {
		t.Fatal("organization context must yield an organization-scoped store")
	}
	if _, ok := (&Store{OpenClawSessionStore: store}).OpenClawSessions(ctx).(*noop.OpenClawSessionStore); !ok {
		t.Fatal("a context with no organization must yield the noop store")
	}
	want := &cloudhub.OpenClawSession{
		ID:             "session-1",
		OrganizationID: "org-a",
		UserID:         "user-1",
		AgentID:        "main",
		SessionKey:     "agent:main:cloudhub:org-a:user-1:session-1",
		Title:          "Investigate latency",
		CreatedAt:      createdAt,
		UpdatedAt:      createdAt,
	}

	created, err := store.Create(ctx, want)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if *created != *want {
		t.Fatalf("Create() = %#v, want %#v", created, want)
	}

	got, err := store.Get(ctx, want.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if *got != *want {
		t.Fatalf("Get() = %#v, want %#v", got, want)
	}

	if _, err := store.Create(ctx, &cloudhub.OpenClawSession{ID: "session-2", OrganizationID: "org-b"}); err != nil {
		t.Fatalf("Create(other organization) error = %v", err)
	}
	sessions, err := store.List(ctx, "org-a")
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(sessions) != 1 || sessions[0].ID != want.ID {
		t.Fatalf("List(org-a) = %#v, want only session %q", sessions, want.ID)
	}

	if _, err := store.Get(ctx, "missing"); err != cloudhub.ErrOpenClawSessionNotFound {
		t.Fatalf("Get(missing) error = %v, want ErrOpenClawSessionNotFound", err)
	}
}

func TestOpenClawChatSessionStoreContractSoftDeletesSessions(t *testing.T) {
	ctx := context.Background()
	store := newOpenClawSessionStoreContract()
	session := &cloudhub.OpenClawSession{ID: "deleted", OrganizationID: "org-a"}
	if _, err := store.Create(ctx, session); err != nil {
		t.Fatal(err)
	}

	if err := store.Delete(ctx, session.ID); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if _, err := store.Get(ctx, session.ID); err != cloudhub.ErrOpenClawSessionNotFound {
		t.Fatalf("Get(deleted) error = %v, want ErrOpenClawSessionNotFound", err)
	}
	if sessions, err := store.List(ctx, session.OrganizationID); err != nil || len(sessions) != 0 {
		t.Fatalf("List() = %#v, %v; want no deleted sessions", sessions, err)
	}
	if err := store.Touch(ctx, session.ID, time.Now().UTC()); err != cloudhub.ErrOpenClawSessionNotFound {
		t.Fatalf("Touch(deleted) error = %v, want ErrOpenClawSessionNotFound", err)
	}
}

type openClawSessionStoreContract struct {
	items map[string]*cloudhub.OpenClawSession
}

func newOpenClawSessionStoreContract() *openClawSessionStoreContract {
	return &openClawSessionStoreContract{items: make(map[string]*cloudhub.OpenClawSession)}
}

func (s *openClawSessionStoreContract) Create(_ context.Context, session *cloudhub.OpenClawSession) (*cloudhub.OpenClawSession, error) {
	s.items[session.ID] = session
	return session, nil
}

func (s *openClawSessionStoreContract) Get(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
	session, ok := s.items[id]
	if !ok {
		return nil, cloudhub.ErrOpenClawSessionNotFound
	}
	return session, nil
}

func (s *openClawSessionStoreContract) List(_ context.Context, organizationID string) ([]cloudhub.OpenClawSession, error) {
	sessions := make([]cloudhub.OpenClawSession, 0)
	for _, session := range s.items {
		if session.OrganizationID == organizationID {
			sessions = append(sessions, *session)
		}
	}
	return sessions, nil
}

func (s *openClawSessionStoreContract) Touch(_ context.Context, id string, updatedAt time.Time) error {
	session, err := s.Get(context.Background(), id)
	if err != nil {
		return err
	}
	session.UpdatedAt = updatedAt
	return nil
}

func (s *openClawSessionStoreContract) Delete(_ context.Context, id string) error {
	if _, ok := s.items[id]; !ok {
		return cloudhub.ErrOpenClawSessionNotFound
	}
	delete(s.items, id)
	return nil
}

var _ cloudhub.OpenClawSessionStore = (*openClawSessionStoreContract)(nil)
