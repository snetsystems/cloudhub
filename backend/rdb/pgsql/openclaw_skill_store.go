package pgsql

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

var _ cloudhub.OpenClawSkillStore = (*OpenClawSkillStore)(nil)

// OpenClawSkillStore persists organization-authored skills, their revisions,
// and every revision's complete file set in PostgreSQL.
type OpenClawSkillStore struct {
	db rdb.Store
}

// NewOpenClawSkillStore returns a PostgreSQL-backed skill store.
func NewOpenClawSkillStore(db rdb.Store) *OpenClawSkillStore {
	return &OpenClawSkillStore{db: db}
}

const openClawSkillColumns = `id, organization_id, name, status, COALESCE(active_revision, 0),
	created_by, created_at, updated_at, deleted_at`

type openClawRowScanner interface {
	Scan(dest ...any) error
}

func scanOpenClawSkill(s openClawRowScanner) (*cloudhub.OpenClawSkill, error) {
	skill := &cloudhub.OpenClawSkill{}
	if err := s.Scan(
		&skill.ID, &skill.OrganizationID, &skill.Name, &skill.Status,
		&skill.ActiveRevision, &skill.CreatedBy, &skill.CreatedAt,
		&skill.UpdatedAt, &skill.DeletedAt,
	); err != nil {
		return nil, err
	}
	return skill, nil
}

// List returns the organization's skills, newest first.
//
// The deleted_at filter is what keeps rows written before skills were deleted
// outright out of the list. Nothing sets the column now.
func (s *OpenClawSkillStore) List(ctx context.Context, organizationID string) ([]cloudhub.OpenClawSkill, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT `+openClawSkillColumns+`
		FROM openclaw_skills
		WHERE organization_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC`, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list openclaw skills: %w", err)
	}
	defer rows.Close()

	skills := []cloudhub.OpenClawSkill{}
	for rows.Next() {
		skill, err := scanOpenClawSkill(rows)
		if err != nil {
			return nil, fmt.Errorf("scan openclaw skill: %w", err)
		}
		skills = append(skills, *skill)
	}
	return skills, rows.Err()
}

// Get returns one skill. A skill in another organization reports the same
// not-found error as one that does not exist, so a caller cannot use the
// difference to discover foreign IDs.
func (s *OpenClawSkillStore) Get(ctx context.Context, organizationID, id string) (*cloudhub.OpenClawSkill, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT `+openClawSkillColumns+`
		FROM openclaw_skills
		WHERE organization_id = $1 AND id = $2`, organizationID, id)
	skill, err := scanOpenClawSkill(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, cloudhub.ErrOpenClawSkillNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get openclaw skill: %w", err)
	}
	return skill, nil
}

// Create stores a skill together with its first revision in one transaction,
// so a skill never exists without content to review.
func (s *OpenClawSkillStore) Create(ctx context.Context, skill *cloudhub.OpenClawSkill, rev *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkill, error) {
	err := s.db.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO openclaw_skills (
				id, organization_id, name, status, active_revision,
				next_revision, created_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, NULL, 2, $5, $6, $7)`,
			skill.ID, skill.OrganizationID, skill.Name, skill.Status,
			skill.CreatedBy, skill.CreatedAt, skill.UpdatedAt); err != nil {
			return fmt.Errorf("insert openclaw skill: %w", err)
		}
		rev.SkillID = skill.ID
		rev.Revision = 1
		return insertOpenClawRevision(ctx, tx, rev)
	})
	if err != nil {
		return nil, err
	}
	return skill, nil
}

// AddRevision appends the next revision to a skill. The revision number is
// derived inside the transaction so two concurrent submissions cannot claim
// the same one.
func (s *OpenClawSkillStore) AddRevision(ctx context.Context, organizationID, skillID string, rev *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkillRevision, error) {
	err := s.db.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		/*
			Taking the number from the skill's own counter, rather than from
			MAX(revision) over the rows that happen to be left, is what keeps a
			number from coming back. MAX only sees what survives, so deleting
			the highest revision would hand its number to different content and
			make an earlier reference to it mean something else.

			The same statement checks ownership and touches updated_at: a skill
			that is absent, retired, or another organization's matches nothing
			and no number is issued.
		*/
		var next int
		if err := tx.QueryRowContext(ctx, `
			UPDATE openclaw_skills
			SET next_revision = next_revision + 1, updated_at = $3
			WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
			RETURNING next_revision - 1`,
			skillID, organizationID, rev.CreatedAt).Scan(&next); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return cloudhub.ErrOpenClawSkillNotFound
			}
			return fmt.Errorf("next openclaw revision number: %w", err)
		}
		rev.SkillID = skillID
		rev.Revision = next
		return insertOpenClawRevision(ctx, tx, rev)
	})
	if err != nil {
		return nil, err
	}
	return rev, nil
}

func insertOpenClawRevision(ctx context.Context, tx rdb.Store, rev *cloudhub.OpenClawSkillRevision) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO openclaw_skill_revisions (
			id, skill_id, revision, tree_hash, goal, author_id,
			review_status, review_note, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		rev.ID, rev.SkillID, rev.Revision, rev.TreeHash, rev.Goal,
		rev.AuthorID, rev.ReviewStatus, rev.ReviewNote, rev.CreatedAt); err != nil {
		return fmt.Errorf("insert openclaw skill revision: %w", err)
	}
	for _, file := range rev.Files {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO openclaw_skill_revision_files (
				revision_id, path, content, content_hash, size_bytes
			) VALUES ($1, $2, $3, $4, $5)`,
			rev.ID, file.Path, file.Content, file.ContentHash, file.SizeBytes); err != nil {
			return fmt.Errorf("insert openclaw skill revision file %q: %w", file.Path, err)
		}
	}
	return nil
}

const openClawRevisionColumns = `id, skill_id, revision, tree_hash, goal, author_id,
	review_status, COALESCE(reviewed_by, ''), reviewed_at, review_note,
	COALESCE(gateway_proposal_id, ''), gateway_scan, created_at`

func scanOpenClawRevision(s openClawRowScanner) (*cloudhub.OpenClawSkillRevision, error) {
	rev := &cloudhub.OpenClawSkillRevision{}
	if err := s.Scan(
		&rev.ID, &rev.SkillID, &rev.Revision, &rev.TreeHash, &rev.Goal,
		&rev.AuthorID, &rev.ReviewStatus, &rev.ReviewedBy, &rev.ReviewedAt,
		&rev.ReviewNote, &rev.GatewayProposalID, &rev.GatewayScan, &rev.CreatedAt,
	); err != nil {
		return nil, err
	}
	return rev, nil
}

// Revisions returns a skill's revisions newest first, without file contents:
// the history list does not need them and they are the bulk of the rows.
func (s *OpenClawSkillStore) Revisions(ctx context.Context, organizationID, skillID string) ([]cloudhub.OpenClawSkillRevision, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT `+openClawRevisionColumns+`
		FROM openclaw_skill_revisions r
		WHERE r.skill_id = $1
		  AND EXISTS (SELECT 1 FROM openclaw_skills s
		              WHERE s.id = r.skill_id AND s.organization_id = $2)
		ORDER BY r.revision DESC`, skillID, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list openclaw skill revisions: %w", err)
	}
	defer rows.Close()

	revs := []cloudhub.OpenClawSkillRevision{}
	for rows.Next() {
		rev, err := scanOpenClawRevision(rows)
		if err != nil {
			return nil, fmt.Errorf("scan openclaw skill revision: %w", err)
		}
		revs = append(revs, *rev)
	}
	return revs, rows.Err()
}

// Revision returns one revision with its complete file set, sorted by path so
// SKILL.md leads and the caller sees a stable order.
func (s *OpenClawSkillStore) Revision(ctx context.Context, organizationID, skillID string, revision int) (*cloudhub.OpenClawSkillRevision, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT `+openClawRevisionColumns+`
		FROM openclaw_skill_revisions r
		WHERE r.skill_id = $1 AND r.revision = $2
		  AND EXISTS (SELECT 1 FROM openclaw_skills s
		              WHERE s.id = r.skill_id AND s.organization_id = $3)`,
		skillID, revision, organizationID)
	rev, err := scanOpenClawRevision(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, cloudhub.ErrOpenClawSkillNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get openclaw skill revision: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT path, content, content_hash, size_bytes
		FROM openclaw_skill_revision_files
		WHERE revision_id = $1 ORDER BY path`, rev.ID)
	if err != nil {
		return nil, fmt.Errorf("list openclaw skill revision files: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var file cloudhub.OpenClawSkillFile
		if err := rows.Scan(&file.Path, &file.Content, &file.ContentHash, &file.SizeBytes); err != nil {
			return nil, fmt.Errorf("scan openclaw skill revision file: %w", err)
		}
		rev.Files = append(rev.Files, file)
	}
	return rev, rows.Err()
}

// UpdateRevisionReview records an Admin's decision on one revision.
func (s *OpenClawSkillStore) UpdateRevisionReview(ctx context.Context, organizationID, skillID string, revision int, review cloudhub.OpenClawSkillReview) error {
	tag, err := s.db.ExecContext(ctx, `
		UPDATE openclaw_skill_revisions r
		SET review_status = $4, reviewed_by = $5, reviewed_at = $6,
		    review_note = $7, gateway_proposal_id = NULLIF($8, ''), gateway_scan = $9
		WHERE r.skill_id = $1 AND r.revision = $2
		  AND EXISTS (SELECT 1 FROM openclaw_skills s
		              WHERE s.id = r.skill_id AND s.organization_id = $3)`,
		skillID, revision, organizationID, review.Status, review.ReviewedBy,
		review.ReviewedAt, review.Note, review.ProposalID, review.Scan)
	if err != nil {
		return fmt.Errorf("update openclaw skill revision review: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return cloudhub.ErrOpenClawSkillNotFound
	}
	return nil
}

// SetActiveRevision points a skill at the revision now live on the Gateway and
// marks the skill approved.
func (s *OpenClawSkillStore) SetActiveRevision(ctx context.Context, organizationID, skillID string, revision int) error {
	tag, err := s.db.ExecContext(ctx, `
		UPDATE openclaw_skills
		SET active_revision = $3, status = $4, updated_at = NOW()
		WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		skillID, organizationID, revision, cloudhub.OpenClawSkillApproved)
	if err != nil {
		return fmt.Errorf("set openclaw skill active revision: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return cloudhub.ErrOpenClawSkillNotFound
	}
	return nil
}

// Delete removes a skill outright. Its revisions and their files go with it:
// both foreign keys cascade, so one statement clears the whole history.
func (s *OpenClawSkillStore) Delete(ctx context.Context, organizationID, id string) error {
	tag, err := s.db.ExecContext(ctx, `
		DELETE FROM openclaw_skills
		WHERE id = $1 AND organization_id = $2`, id, organizationID)
	if err != nil {
		return fmt.Errorf("delete openclaw skill: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return cloudhub.ErrOpenClawSkillNotFound
	}
	return nil
}

// DeleteRevision removes one revision. Its files cascade with it.
//
// The organization is checked through the parent skill, because a revision
// carries no organization of its own; without the join a caller could delete a
// revision of another organization's skill by guessing an id.
//
// Numbering is not repaired. The next revision is MAX(revision) + 1, so a
// deleted number stays a gap rather than being handed to different content -
// which would make an older reference point at something it never described.
func (s *OpenClawSkillStore) DeleteRevision(ctx context.Context, organizationID, skillID string, revision int) error {
	tag, err := s.db.ExecContext(ctx, `
		DELETE FROM openclaw_skill_revisions r
		USING openclaw_skills s
		WHERE r.skill_id = s.id
		  AND r.skill_id = $1
		  AND r.revision = $2
		  AND s.organization_id = $3`, skillID, revision, organizationID)
	if err != nil {
		return fmt.Errorf("delete openclaw skill revision: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return cloudhub.ErrOpenClawSkillNotFound
	}
	return nil
}
