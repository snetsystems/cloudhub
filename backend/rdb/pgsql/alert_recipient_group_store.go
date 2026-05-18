package pgsql

import (
	"context"
	"fmt"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.AlertRecipientGroupStore = (*AlertRecipientGroupStore)(nil)

type AlertRecipientGroupStore struct{ client *Client }

func NewAlertRecipientGroupStore(client *Client) *AlertRecipientGroupStore {
	return &AlertRecipientGroupStore{client: client}
}

const alertRecipientGroupCols = `recipient_group_id, suppression_enabled, suppression_window_seconds, suppression_count, suppression_pause_seconds, created_at, updated_at`

func (s *AlertRecipientGroupStore) Get(ctx context.Context, id string) (cloudhub.AlertRecipientGroup, error) {
	q := `SELECT ` + alertRecipientGroupCols + ` FROM alert_recipient_groups WHERE recipient_group_id = $1`
	var ext cloudhub.AlertRecipientGroup
	var ca, ua time.Time
	if err := s.client.QueryRowContext(ctx, q, id).Scan(
		&ext.RecipientGroupID, &ext.SuppressionEnabled,
		&ext.SuppressionWindowSeconds, &ext.SuppressionCount, &ext.SuppressionPauseSeconds,
		&ca, &ua,
	); err != nil {
		return cloudhub.AlertRecipientGroup{}, fmt.Errorf("alert_recipient_group.Get: %w", err)
	}
	ext.CreatedAt, ext.UpdatedAt = ca, ua
	return ext, nil
}

func (s *AlertRecipientGroupStore) Upsert(ctx context.Context, ext cloudhub.AlertRecipientGroup) error {
	const q = `INSERT INTO alert_recipient_groups
		(recipient_group_id, suppression_enabled, suppression_window_seconds, suppression_count, suppression_pause_seconds)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (recipient_group_id) DO UPDATE SET
			suppression_enabled = EXCLUDED.suppression_enabled,
			suppression_window_seconds = EXCLUDED.suppression_window_seconds,
			suppression_count = EXCLUDED.suppression_count,
			suppression_pause_seconds = EXCLUDED.suppression_pause_seconds,
			updated_at = NOW()`
	if _, err := s.client.ExecContext(ctx, q,
		ext.RecipientGroupID, ext.SuppressionEnabled,
		ext.SuppressionWindowSeconds, ext.SuppressionCount, ext.SuppressionPauseSeconds,
	); err != nil {
		return fmt.Errorf("alert_recipient_group.Upsert: %w", err)
	}
	return nil
}

func (s *AlertRecipientGroupStore) Delete(ctx context.Context, id string) error {
	if _, err := s.client.ExecContext(ctx, `DELETE FROM alert_recipient_groups WHERE recipient_group_id = $1`, id); err != nil {
		return fmt.Errorf("alert_recipient_group.Delete: %w", err)
	}
	return nil
}
