package pgsql

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

var _ cloudhub.OpenClawSessionStore = (*OpenClawSessionStore)(nil)

// OpenClawSessionStore persists session ownership and the Gateway session key
// in PostgreSQL.
type OpenClawSessionStore struct {
	db rdb.Store
}

// NewOpenClawSessionStore returns a PostgreSQL-backed session store.
func NewOpenClawSessionStore(db rdb.Store) *OpenClawSessionStore {
	return &OpenClawSessionStore{db: db}
}

const openClawSessionColumns = `id, organization_id, user_id, agent_id, openclaw_session_key, title, created_at, updated_at`

type openClawSessionScanner interface {
	Scan(dest ...any) error
}

func scanOpenClawSession(scanner openClawSessionScanner) (*cloudhub.OpenClawSession, error) {
	session := &cloudhub.OpenClawSession{}
	if err := scanner.Scan(
		&session.ID,
		&session.OrganizationID,
		&session.UserID,
		&session.AgentID,
		&session.SessionKey,
		&session.Title,
		&session.CreatedAt,
		&session.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return session, nil
}

// Create persists a session and its globally unique OpenClaw session key.
func (s *OpenClawSessionStore) Create(ctx context.Context, session *cloudhub.OpenClawSession) (*cloudhub.OpenClawSession, error) {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO openclaw_sessions (
			id, organization_id, user_id, agent_id, openclaw_session_key, title, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		session.ID,
		session.OrganizationID,
		session.UserID,
		session.AgentID,
		session.SessionKey,
		session.Title,
		session.CreatedAt,
		session.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("pgsql:openclaw session create: %w", err)
	}
	return session, nil
}

// Get loads a session by its CloudHub-generated ID.
func (s *OpenClawSessionStore) Get(ctx context.Context, id string) (*cloudhub.OpenClawSession, error) {
	session, err := scanOpenClawSession(s.db.QueryRowContext(ctx, `
		SELECT `+openClawSessionColumns+`
		FROM openclaw_sessions
		WHERE id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, cloudhub.ErrOpenClawSessionNotFound
		}
		return nil, fmt.Errorf("pgsql:openclaw session get: %w", err)
	}
	return session, nil
}

// List returns all sessions belonging to an organization, newest activity first.
func (s *OpenClawSessionStore) List(ctx context.Context, organizationID string) ([]cloudhub.OpenClawSession, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT `+openClawSessionColumns+`
		FROM openclaw_sessions
		WHERE organization_id = $1
		ORDER BY updated_at DESC`, organizationID)
	if err != nil {
		return nil, fmt.Errorf("pgsql:openclaw session list: %w", err)
	}
	defer rows.Close()

	sessions := []cloudhub.OpenClawSession{}
	for rows.Next() {
		session, err := scanOpenClawSession(rows)
		if err != nil {
			return nil, fmt.Errorf("pgsql:openclaw session list scan: %w", err)
		}
		sessions = append(sessions, *session)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("pgsql:openclaw session list rows: %w", err)
	}
	return sessions, nil
}

// Touch records the most recent activity time for a session.
func (s *OpenClawSessionStore) Touch(ctx context.Context, id string, updatedAt time.Time) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE openclaw_sessions
		SET updated_at = $2
		WHERE id = $1`, id, updatedAt)
	if err != nil {
		return fmt.Errorf("pgsql:openclaw session touch: %w", err)
	}
	if result.RowsAffected() == 0 {
		return cloudhub.ErrOpenClawSessionNotFound
	}
	return nil
}
