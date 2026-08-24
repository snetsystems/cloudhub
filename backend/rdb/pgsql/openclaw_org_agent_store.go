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

var _ cloudhub.OpenClawOrgAgentStore = (*OpenClawOrgAgentStore)(nil)

// OpenClawOrgAgentStore persists which Gateway agent an organization uses for
// each purpose: one that drafts skills, one that runs them.
type OpenClawOrgAgentStore struct {
	db rdb.Store
}

// NewOpenClawOrgAgentStore returns a PostgreSQL-backed org agent store.
func NewOpenClawOrgAgentStore(db rdb.Store) *OpenClawOrgAgentStore {
	return &OpenClawOrgAgentStore{db: db}
}

// Get returns the agent bound to a purpose, or ErrOpenClawAgentNotMapped when
// the organization has not been set up for it.
func (s *OpenClawOrgAgentStore) Get(ctx context.Context, organizationID, purpose string) (string, error) {
	var agentID string
	err := s.db.QueryRowContext(ctx, `
		SELECT agent_id FROM openclaw_org_agents
		WHERE organization_id = $1 AND purpose = $2 AND deleted_at IS NULL`, organizationID, purpose).Scan(&agentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", cloudhub.ErrOpenClawAgentNotMapped
	}
	if err != nil {
		return "", fmt.Errorf("get openclaw org agent: %w", err)
	}
	return agentID, nil
}

// Ensure binds agentID to a purpose only if nothing is bound yet, and returns
// whatever ends up bound.
//
// The insert is conditional and the read follows it, so two requests
// provisioning the same organization at once settle on one agent instead of
// the second overwriting the first. Replace cannot be used for this: it clears
// the organization, so provisioning an execution agent would drop the
// authoring one.
func (s *OpenClawOrgAgentStore) Ensure(ctx context.Context, organizationID, purpose, agentID string) (string, error) {
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO openclaw_org_agents (organization_id, purpose, agent_id, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (organization_id, purpose) WHERE deleted_at IS NULL DO NOTHING`,
		organizationID, purpose, agentID, time.Now().UTC()); err != nil {
		return "", fmt.Errorf("ensure openclaw org agent %q: %w", purpose, err)
	}
	return s.Get(ctx, organizationID, purpose)
}

// Replace swaps the organization's entire mapping in one transaction. A
// purpose absent from agents is removed, so the map the caller passes is the
// whole truth rather than a patch.
func (s *OpenClawOrgAgentStore) Replace(ctx context.Context, organizationID string, agents map[string]string) error {
	now := time.Now().UTC()
	return s.db.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `
			DELETE FROM openclaw_org_agents WHERE organization_id = $1`, organizationID); err != nil {
			return fmt.Errorf("clear openclaw org agents: %w", err)
		}
		for purpose, agentID := range agents {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO openclaw_org_agents (organization_id, purpose, agent_id, created_at)
				VALUES ($1, $2, $3, $4)`, organizationID, purpose, agentID, now); err != nil {
				return fmt.Errorf("insert openclaw org agent %q: %w", purpose, err)
			}
		}
		return nil
	})
}

// All returns every live mapping for an organization, keyed by purpose.
func (s *OpenClawOrgAgentStore) All(ctx context.Context, organizationID string) (map[string]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT purpose, agent_id FROM openclaw_org_agents
		WHERE organization_id = $1 AND deleted_at IS NULL`, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list openclaw org agents: %w", err)
	}
	defer rows.Close()

	agents := map[string]string{}
	for rows.Next() {
		var purpose, agentID string
		if err := rows.Scan(&purpose, &agentID); err != nil {
			return nil, fmt.Errorf("scan openclaw org agent: %w", err)
		}
		agents[purpose] = agentID
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list openclaw org agents: %w", err)
	}
	return agents, nil
}

// SoftDelete retires an organization's mappings, keeping the rows so the
// binding can be recovered. Already-retired rows keep their original
// timestamp, so a repeated organization deletion does not rewrite history.
func (s *OpenClawOrgAgentStore) SoftDelete(ctx context.Context, organizationID string) error {
	if _, err := s.db.ExecContext(ctx, `
		UPDATE openclaw_org_agents SET deleted_at = $2
		WHERE organization_id = $1 AND deleted_at IS NULL`,
		organizationID, time.Now().UTC()); err != nil {
		return fmt.Errorf("soft delete openclaw org agents: %w", err)
	}
	return nil
}

// PendingReclaim returns retired mappings whose workspace has not been
// confirmed reclaimed, oldest first so a sweep clears the longest-standing
// leftovers before anything that just failed.
//
// This spans every organization: the caller is an operator clearing leftovers,
// not a member acting inside one organization.
func (s *OpenClawOrgAgentStore) PendingReclaim(ctx context.Context) ([]cloudhub.OpenClawPendingReclaim, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT organization_id, purpose, agent_id, deleted_at FROM openclaw_org_agents
		WHERE deleted_at IS NOT NULL AND reclaimed_at IS NULL
		ORDER BY deleted_at`)
	if err != nil {
		return nil, fmt.Errorf("list openclaw workspaces pending reclaim: %w", err)
	}
	defer rows.Close()

	pending := []cloudhub.OpenClawPendingReclaim{}
	for rows.Next() {
		var entry cloudhub.OpenClawPendingReclaim
		if err := rows.Scan(&entry.OrganizationID, &entry.Purpose, &entry.AgentID, &entry.DeletedAt); err != nil {
			return nil, fmt.Errorf("scan openclaw workspace pending reclaim: %w", err)
		}
		pending = append(pending, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list openclaw workspaces pending reclaim: %w", err)
	}
	return pending, nil
}

// MarkReclaimed records that a retired mapping's workspace is gone.
//
// Only retired rows are touched. A live mapping has a workspace in use, and
// marking it reclaimed would hide a real leftover if the organization were
// deleted later.
func (s *OpenClawOrgAgentStore) MarkReclaimed(ctx context.Context, organizationID, purpose string) error {
	if _, err := s.db.ExecContext(ctx, `
		UPDATE openclaw_org_agents SET reclaimed_at = $3
		WHERE organization_id = $1 AND purpose = $2
		  AND deleted_at IS NOT NULL AND reclaimed_at IS NULL`,
		organizationID, purpose, time.Now().UTC()); err != nil {
		return fmt.Errorf("mark openclaw workspace reclaimed: %w", err)
	}
	return nil
}
