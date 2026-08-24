package pgsql_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func setupOpenClawSessionStore(t *testing.T) (*pgsql.Client, *pgsql.OpenClawSessionStore, func()) {
	t.Helper()
	client, cleanup := setupTestDB(t)

	sql, err := os.ReadFile("migrations/006_create_openclaw_sessions.sql")
	if err != nil {
		cleanup()
		t.Fatalf("read session migration: %v", err)
	}
	if _, err := client.ExecContext(context.Background(), string(sql)); err != nil {
		cleanup()
		t.Fatalf("run session migration: %v", err)
	}
	softDeleteSQL, err := os.ReadFile("migrations/007_soft_delete_openclaw_sessions.sql")
	if err != nil {
		cleanup()
		t.Fatalf("read soft-delete migration: %v", err)
	}
	if _, err := client.ExecContext(context.Background(), string(softDeleteSQL)); err != nil {
		cleanup()
		t.Fatalf("run soft-delete migration: %v", err)
	}

	return client, pgsql.NewOpenClawSessionStore(client), cleanup
}

func TestOpenClawSessionStoreSoftDeletesSessions(t *testing.T) {
	client, store, cleanup := setupOpenClawSessionStore(t)
	defer cleanup()
	defer cleanupOpenClawSession(t, client, "openclaw-soft-delete-session")

	ctx := context.Background()
	session := &cloudhub.OpenClawSession{
		ID:             "openclaw-soft-delete-session",
		OrganizationID: "openclaw-soft-delete-org",
		UserID:         "openclaw-soft-delete-user",
		AgentID:        "main",
		SessionKey:     "agent:main:cloudhub:openclaw-soft-delete-session",
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if _, err := store.Create(ctx, session); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := store.Delete(ctx, session.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := store.Get(ctx, session.ID); !errors.Is(err, cloudhub.ErrOpenClawSessionNotFound) {
		t.Fatalf("Get(deleted) error = %v, want ErrOpenClawSessionNotFound", err)
	}
	if sessions, err := store.List(ctx, session.OrganizationID); err != nil || len(sessions) != 0 {
		t.Fatalf("List() = %#v, %v; want no deleted sessions", sessions, err)
	}
	if err := store.Touch(ctx, session.ID, time.Now().UTC()); !errors.Is(err, cloudhub.ErrOpenClawSessionNotFound) {
		t.Fatalf("Touch(deleted) error = %v, want ErrOpenClawSessionNotFound", err)
	}
}

func cleanupOpenClawSession(t *testing.T, client *pgsql.Client, id string) {
	t.Helper()
	_, _ = client.ExecContext(context.Background(), "DELETE FROM openclaw_sessions WHERE id = $1", id)
}

// This fails if a store stops persisting a session field, omits List's
// organization filter, fails to map a missing row, or makes Touch a no-op.
func TestOpenClawSessionStorePersistsScopedSessionsAndTouchesThem(t *testing.T) {
	client, store, cleanup := setupOpenClawSessionStore(t)
	defer cleanup()
	defer cleanupOpenClawSession(t, client, "openclaw-session-a")
	defer cleanupOpenClawSession(t, client, "openclaw-session-b")

	ctx := context.Background()
	createdAt := time.Date(2026, time.August, 5, 12, 0, 0, 0, time.UTC)
	session := &cloudhub.OpenClawSession{
		ID:             "openclaw-session-a",
		OrganizationID: "openclaw-org-a",
		UserID:         "openclaw-user-a",
		AgentID:        "main",
		SessionKey:     "agent:main:cloudhub:openclaw-org-a:openclaw-user-a:openclaw-session-a",
		Title:          "Capacity discussion",
		CreatedAt:      createdAt,
		UpdatedAt:      createdAt,
	}
	if _, err := store.Create(ctx, session); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := store.Create(ctx, &cloudhub.OpenClawSession{
		ID:             "openclaw-session-b",
		OrganizationID: "openclaw-org-b",
		UserID:         "openclaw-user-b",
		AgentID:        "main",
		SessionKey:     "agent:main:cloudhub:openclaw-org-b:openclaw-user-b:openclaw-session-b",
		Title:          "Other organization",
		CreatedAt:      createdAt,
		UpdatedAt:      createdAt,
	}); err != nil {
		t.Fatalf("Create(other organization): %v", err)
	}

	got, err := store.Get(ctx, session.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	// Compare the timestamps as instants. The driver hands back times located
	// in time.Local, so comparing the structs would compare *time.Location
	// pointers and fail even when both sides name the same moment.
	if !got.CreatedAt.Equal(session.CreatedAt) || !got.UpdatedAt.Equal(session.UpdatedAt) {
		t.Fatalf("Get timestamps = %v/%v, want %v/%v",
			got.CreatedAt, got.UpdatedAt, session.CreatedAt, session.UpdatedAt)
	}
	gotCopy, wantCopy := *got, *session
	gotCopy.CreatedAt, gotCopy.UpdatedAt = time.Time{}, time.Time{}
	wantCopy.CreatedAt, wantCopy.UpdatedAt = time.Time{}, time.Time{}
	if gotCopy != wantCopy {
		t.Fatalf("Get = %#v, want %#v", got, session)
	}

	listed, err := store.List(ctx, session.OrganizationID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(listed) != 1 || listed[0].ID != session.ID || listed[0].OrganizationID != session.OrganizationID {
		t.Fatalf("List(%q) = %#v, want only %q", session.OrganizationID, listed, session.ID)
	}

	if _, err := store.Get(ctx, "openclaw-session-missing"); !errors.Is(err, cloudhub.ErrOpenClawSessionNotFound) {
		t.Fatalf("Get(missing) error = %v, want ErrOpenClawSessionNotFound", err)
	}

	updatedAt := createdAt.Add(time.Hour).Truncate(time.Microsecond)
	if err := store.Touch(ctx, session.ID, updatedAt); err != nil {
		t.Fatalf("Touch: %v", err)
	}
	got, err = store.Get(ctx, session.ID)
	if err != nil {
		t.Fatalf("Get(after Touch): %v", err)
	}
	if !got.UpdatedAt.Equal(updatedAt) {
		t.Fatalf("UpdatedAt after Touch = %s, want %s", got.UpdatedAt, updatedAt)
	}
	if err := store.Touch(ctx, "openclaw-session-missing", updatedAt); !errors.Is(err, cloudhub.ErrOpenClawSessionNotFound) {
		t.Fatalf("Touch(missing) error = %v, want ErrOpenClawSessionNotFound", err)
	}
}

// This fails if the session key is no longer unique and a request can attach
// two CloudHub sessions to one OpenClaw session.
func TestOpenClawSessionStoreRejectsDuplicateSessionKey(t *testing.T) {
	client, store, cleanup := setupOpenClawSessionStore(t)
	defer cleanup()
	defer cleanupOpenClawSession(t, client, "openclaw-duplicate-session-a")
	defer cleanupOpenClawSession(t, client, "openclaw-duplicate-session-b")

	ctx := context.Background()
	first := &cloudhub.OpenClawSession{
		ID:             "openclaw-duplicate-session-a",
		OrganizationID: "openclaw-duplicate-org",
		UserID:         "openclaw-duplicate-user",
		AgentID:        "main",
		SessionKey:     "agent:main:cloudhub:duplicate-session",
		CreatedAt:      time.Date(2026, time.August, 5, 12, 0, 0, 0, time.UTC),
		UpdatedAt:      time.Date(2026, time.August, 5, 12, 0, 0, 0, time.UTC),
	}
	if _, err := store.Create(ctx, first); err != nil {
		t.Fatalf("first Create: %v", err)
	}

	duplicate := *first
	duplicate.ID = "openclaw-duplicate-session-b"
	if _, err := store.Create(ctx, &duplicate); err == nil {
		t.Fatal("second Create with the same session key succeeded")
	}
}
