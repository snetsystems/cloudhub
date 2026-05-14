package pgsql

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.AlertKapacitorMappingStore = (*AlertKapacitorMappingStore)(nil)

// AlertKapacitorMappingStore manages v1-to-v2 Kapacitor ID mappings in PostgreSQL.
type AlertKapacitorMappingStore struct{ client *Client }

// NewAlertKapacitorMappingStore creates a new AlertKapacitorMappingStore.
func NewAlertKapacitorMappingStore(client *Client) *AlertKapacitorMappingStore {
	return &AlertKapacitorMappingStore{client: client}
}

func (s *AlertKapacitorMappingStore) Put(ctx context.Context, sourceID, legacyKapacitorID int, alertKapacitorID string) error {
	const q = `INSERT INTO alert_kapacitor_mappings (source_id, legacy_kapacitor_id, alert_kapacitor_id, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (source_id, legacy_kapacitor_id)
		DO UPDATE SET alert_kapacitor_id = EXCLUDED.alert_kapacitor_id, updated_at = NOW()`
	if _, err := s.client.ExecContext(ctx, q, sourceID, legacyKapacitorID, alertKapacitorID); err != nil {
		return fmt.Errorf("alert_kapacitor_mapping.Put: %w", err)
	}
	return nil
}

func (s *AlertKapacitorMappingStore) GetAlertKapacitorID(ctx context.Context, sourceID, legacyKapacitorID int) (string, error) {
	const q = `SELECT alert_kapacitor_id FROM alert_kapacitor_mappings WHERE source_id = $1 AND legacy_kapacitor_id = $2`
	var alertKapacitorID string
	if err := s.client.QueryRowContext(ctx, q, sourceID, legacyKapacitorID).Scan(&alertKapacitorID); err != nil {
		return "", fmt.Errorf("alert_kapacitor_mapping.GetAlertKapacitorID: %w", err)
	}
	return alertKapacitorID, nil
}

func (s *AlertKapacitorMappingStore) Delete(ctx context.Context, sourceID, legacyKapacitorID int) error {
	const q = `DELETE FROM alert_kapacitor_mappings WHERE source_id = $1 AND legacy_kapacitor_id = $2`
	if _, err := s.client.ExecContext(ctx, q, sourceID, legacyKapacitorID); err != nil {
		return fmt.Errorf("alert_kapacitor_mapping.Delete: %w", err)
	}
	return nil
}
