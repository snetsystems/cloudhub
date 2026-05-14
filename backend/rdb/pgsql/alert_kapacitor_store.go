package pgsql

import (
	"context"
	"fmt"
	"strings"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.AlertKapacitorStore = (*AlertKapacitorStore)(nil)

// AlertKapacitorStore manages AlertKapacitor persistence in PostgreSQL.
type AlertKapacitorStore struct{ client *Client }

// NewAlertKapacitorStore creates a new AlertKapacitorStore.
func NewAlertKapacitorStore(client *Client) *AlertKapacitorStore {
	return &AlertKapacitorStore{client: client}
}

const alertKapacitorCols = `id, org_id, name, url, username, password, insecure_skip_verify, created_at, updated_at`

func normalizeAlertKapacitorURL(raw string) string {
	return strings.TrimRight(raw, "/")
}

func (s *AlertKapacitorStore) scan(row interface{ Scan(...any) error }) (cloudhub.AlertKapacitor, error) {
	var k cloudhub.AlertKapacitor
	var ca, ua time.Time
	if err := row.Scan(&k.ID, &k.OrgID, &k.Name, &k.URL, &k.Username, &k.Password, &k.InsecureSkipVerify, &ca, &ua); err != nil {
		return k, fmt.Errorf("alert_kapacitor scan: %w", err)
	}
	k.CreatedAt, k.UpdatedAt = ca, ua
	return k, nil
}

func (s *AlertKapacitorStore) All(ctx context.Context, orgID string) ([]cloudhub.AlertKapacitor, error) {
	q := `SELECT ` + alertKapacitorCols + ` FROM alert_kapacitors WHERE org_id = $1 ORDER BY created_at`
	rows, err := s.client.QueryContext(ctx, q, orgID)
	if err != nil {
		return nil, fmt.Errorf("alert_kapacitor.All: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.AlertKapacitor
	for rows.Next() {
		k, err := s.scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (s *AlertKapacitorStore) Get(ctx context.Context, id string) (cloudhub.AlertKapacitor, error) {
	q := `SELECT ` + alertKapacitorCols + ` FROM alert_kapacitors WHERE id = $1`
	row := s.client.QueryRowContext(ctx, q, id)
	k, err := s.scan(row)
	if err != nil {
		return cloudhub.AlertKapacitor{}, fmt.Errorf("alert_kapacitor.Get: %w", err)
	}
	return k, nil
}

func (s *AlertKapacitorStore) Add(ctx context.Context, k cloudhub.AlertKapacitor) (cloudhub.AlertKapacitor, error) {
	const q = `INSERT INTO alert_kapacitors (org_id, name, url, username, password, insecure_skip_verify, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
		RETURNING id, created_at, updated_at`
	var ca, ua time.Time
	k.URL = normalizeAlertKapacitorURL(k.URL)
	if err := s.client.QueryRowContext(ctx, q,
		k.OrgID, k.Name, k.URL, k.Username, k.Password, k.InsecureSkipVerify,
	).Scan(&k.ID, &ca, &ua); err != nil {
		return cloudhub.AlertKapacitor{}, fmt.Errorf("alert_kapacitor.Add: %w", err)
	}
	k.CreatedAt, k.UpdatedAt = ca, ua
	return k, nil
}

func (s *AlertKapacitorStore) Update(ctx context.Context, k cloudhub.AlertKapacitor) error {
	const q = `UPDATE alert_kapacitors
		SET name=$1, url=$2, username=$3, password=$4, insecure_skip_verify=$5, updated_at=NOW()
		WHERE id=$6`
	k.URL = normalizeAlertKapacitorURL(k.URL)
	if _, err := s.client.ExecContext(ctx, q,
		k.Name, k.URL, k.Username, k.Password, k.InsecureSkipVerify, k.ID,
	); err != nil {
		return fmt.Errorf("alert_kapacitor.Update: %w", err)
	}
	return nil
}

func (s *AlertKapacitorStore) Delete(ctx context.Context, id string) error {
	if _, err := s.client.ExecContext(ctx, `DELETE FROM alert_kapacitors WHERE id = $1`, id); err != nil {
		return fmt.Errorf("alert_kapacitor.Delete: %w", err)
	}
	return nil
}
