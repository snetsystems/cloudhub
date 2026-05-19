package pgsql

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.RecipientGroupStore = (*RecipientGroupStore)(nil)

type RecipientGroupStore struct{ client *Client }

func NewRecipientGroupStore(client *Client) *RecipientGroupStore {
	return &RecipientGroupStore{client: client}
}

const recipientGroupCols = `id, org_id, name, delete_yn, created_at, updated_at`

func scanRecipientGroup(row interface{ Scan(...any) error }) (cloudhub.RecipientGroup, error) {
	var g cloudhub.RecipientGroup
	var ca, ua time.Time
	if err := row.Scan(&g.ID, &g.OrgID, &g.Name, &g.DeleteYN, &ca, &ua); err != nil {
		return g, fmt.Errorf("recipient_group scan: %w", err)
	}
	g.CreatedAt, g.UpdatedAt = ca, ua
	return g, nil
}

func (s *RecipientGroupStore) All(ctx context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
	q := `SELECT ` + recipientGroupCols + ` FROM recipient_groups WHERE org_id = $1 AND delete_yn = false ORDER BY created_at`
	rows, err := s.client.QueryContext(ctx, q, orgID)
	if err != nil {
		return nil, fmt.Errorf("recipient_group.All: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.RecipientGroup
	for rows.Next() {
		g, err := scanRecipientGroup(rows)
		if err != nil {
			return nil, err
		}
		g.Members, err = s.Members(ctx, g.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (s *RecipientGroupStore) Get(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
	q := `SELECT ` + recipientGroupCols + ` FROM recipient_groups WHERE id = $1 AND delete_yn = false`
	row := s.client.QueryRowContext(ctx, q, id)
	g, err := scanRecipientGroup(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return cloudhub.RecipientGroup{}, cloudhub.ErrRecipientGroupNotFound
		}
		return cloudhub.RecipientGroup{}, fmt.Errorf("recipient_group.Get: %w", err)
	}
	g.Members, err = s.Members(ctx, id)
	return g, err
}

func (s *RecipientGroupStore) Add(ctx context.Context, g cloudhub.RecipientGroup) (cloudhub.RecipientGroup, error) {
	const q = `INSERT INTO recipient_groups (org_id, name) VALUES ($1,$2) RETURNING id, created_at, updated_at`
	var ca, ua time.Time
	if err := s.client.QueryRowContext(ctx, q, g.OrgID, g.Name).Scan(&g.ID, &ca, &ua); err != nil {
		return cloudhub.RecipientGroup{}, fmt.Errorf("recipient_group.Add: %w", err)
	}
	g.CreatedAt, g.UpdatedAt = ca, ua
	return g, nil
}

func (s *RecipientGroupStore) Update(ctx context.Context, g cloudhub.RecipientGroup) error {
	const q = `UPDATE recipient_groups SET name=$1, updated_at=NOW() WHERE id=$2 AND delete_yn = false`
	if _, err := s.client.ExecContext(ctx, q, g.Name, g.ID); err != nil {
		return fmt.Errorf("recipient_group.Update: %w", err)
	}
	return nil
}

func (s *RecipientGroupStore) Delete(ctx context.Context, id string) error {
	const q = `UPDATE recipient_groups SET delete_yn = true, updated_at = NOW() WHERE id = $1`
	if _, err := s.client.ExecContext(ctx, q, id); err != nil {
		return fmt.Errorf("recipient_group.Delete: %w", err)
	}
	return nil
}

// Member operations

const memberCols = `id, recipient_group_id, user_id, user_name, email, phone_number, delete_yn, created_at, updated_at`

func scanMember(row interface{ Scan(...any) error }) (cloudhub.RecipientGroupMember, error) {
	var m cloudhub.RecipientGroupMember
	var ca, ua time.Time
	if err := row.Scan(&m.ID, &m.RecipientGroupID, &m.UserID, &m.UserName, &m.Email, &m.PhoneNumber, &m.DeleteYN, &ca, &ua); err != nil {
		return m, fmt.Errorf("recipient_group_member scan: %w", err)
	}
	m.CreatedAt, m.UpdatedAt = ca, ua
	return m, nil
}

func (s *RecipientGroupStore) Members(ctx context.Context, groupID string) ([]cloudhub.RecipientGroupMember, error) {
	q := `SELECT ` + memberCols + ` FROM recipient_group_members WHERE recipient_group_id = $1 AND delete_yn = false ORDER BY created_at`
	rows, err := s.client.QueryContext(ctx, q, groupID)
	if err != nil {
		return nil, fmt.Errorf("recipient_group.Members: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.RecipientGroupMember
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *RecipientGroupStore) MembersByUserID(ctx context.Context, orgID, userID string) ([]cloudhub.RecipientGroupMember, error) {
	const cols = `m.id, m.recipient_group_id, m.user_id, m.user_name, m.email, m.phone_number, m.delete_yn, m.created_at, m.updated_at`
	q := `SELECT ` + cols + `
		FROM recipient_group_members m
		JOIN recipient_groups g ON g.id = m.recipient_group_id
		WHERE m.user_id = $1 AND m.delete_yn = false AND g.delete_yn = false`
	args := []any{userID}
	if orgID != "" {
		q += ` AND g.org_id = $2`
		args = append(args, orgID)
	}
	q += ` ORDER BY m.created_at`

	rows, err := s.client.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("recipient_group.MembersByUserID: %w", err)
	}
	defer rows.Close()

	var out []cloudhub.RecipientGroupMember
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *RecipientGroupStore) AddMember(ctx context.Context, m cloudhub.RecipientGroupMember) (cloudhub.RecipientGroupMember, error) {
	const q = `INSERT INTO recipient_group_members (recipient_group_id, user_id, user_name, email, phone_number) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at, updated_at`
	var ca, ua time.Time
	if err := s.client.QueryRowContext(ctx, q, m.RecipientGroupID, m.UserID, m.UserName, m.Email, m.PhoneNumber).Scan(&m.ID, &ca, &ua); err != nil {
		return cloudhub.RecipientGroupMember{}, fmt.Errorf("recipient_group_member.Add: %w", err)
	}
	m.CreatedAt, m.UpdatedAt = ca, ua
	return m, nil
}

func (s *RecipientGroupStore) UpdateMember(ctx context.Context, m cloudhub.RecipientGroupMember) error {
	const q = `UPDATE recipient_group_members SET user_name=$1, email=$2, phone_number=$3, updated_at=NOW() WHERE id=$4 AND delete_yn = false`
	if _, err := s.client.ExecContext(ctx, q, m.UserName, m.Email, m.PhoneNumber, m.ID); err != nil {
		return fmt.Errorf("recipient_group_member.Update: %w", err)
	}
	return nil
}

func (s *RecipientGroupStore) DeleteMember(ctx context.Context, memberID string) error {
	const q = `UPDATE recipient_group_members SET delete_yn = true, updated_at = NOW() WHERE id = $1`
	if _, err := s.client.ExecContext(ctx, q, memberID); err != nil {
		return fmt.Errorf("recipient_group_member.Delete: %w", err)
	}
	return nil
}
