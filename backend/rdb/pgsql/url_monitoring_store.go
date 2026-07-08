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

// Ensure URLMonitoringStore implements cloudhub.URLMonitoringStore at compile time.
var _ cloudhub.URLMonitoringStore = (*URLMonitoringStore)(nil)

// URLMonitoringStore implements cloudhub.URLMonitoringStore on top of postgres.Client.
type URLMonitoringStore struct {
	client *Client
}

// NewURLMonitoringStore returns a URLMonitoringStore backed by the given Client.
func NewURLMonitoringStore(client *Client) *URLMonitoringStore {
	return &URLMonitoringStore{client: client}
}

// All returns all active url_check records (without targets).
func (s *URLMonitoringStore) All(ctx context.Context) ([]cloudhub.URLMonitoring, error) {
	const q = `
SELECT id, org_id, collector_server, created_at, updated_at
FROM url_check WHERE delete_yn = false ORDER BY created_at DESC`

	rows, err := s.client.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("url_check all: %w", err)
	}
	defer rows.Close()

	var result []cloudhub.URLMonitoring
	for rows.Next() {
		var m cloudhub.URLMonitoring
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&m.ID, &m.OrgID, &m.CollectorServer,
			&createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("url_check all scan: %w", err)
		}
		m.Targets = []cloudhub.URLMonitoringTarget{}
		result = append(result, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("url_check all rows: %w", err)
	}
	return result, nil
}

// Add creates a new URLMonitoring with its targets in a single transaction.
func (s *URLMonitoringStore) Add(ctx context.Context, m *cloudhub.URLMonitoring) (*cloudhub.URLMonitoring, error) {
	now := time.Now()
	m.Targets = normalizeTargets(m.Targets)

	err := s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		const insertMonitoring = `
INSERT INTO url_check (org_id, collector_server, created_at, updated_at)
VALUES ($1, $2, $3, $4)
RETURNING id`
		row := tx.QueryRowContext(ctx, insertMonitoring,
			m.OrgID, m.CollectorServer, now, now,
		)
		if err := row.Scan(&m.ID); err != nil {
			return fmt.Errorf("url_check insert: %w", err)
		}
		return insertTargets(ctx, tx, m.ID, m.Targets, now)
	})
	if err != nil {
		return nil, err
	}
	return m, nil
}

// Get retrieves the URLMonitoring (with targets) for a given org ID.
func (s *URLMonitoringStore) Get(ctx context.Context, orgID string) (*cloudhub.URLMonitoring, error) {
	const q = `
SELECT id, org_id, collector_server
FROM url_check WHERE org_id = $1 AND delete_yn = false`

	var m cloudhub.URLMonitoring
	row := s.client.QueryRowContext(ctx, q, orgID)
	if err := row.Scan(&m.ID, &m.OrgID, &m.CollectorServer); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, cloudhub.ErrURLMonitoringNotFound
		}
		return nil, fmt.Errorf("url_check get: %w", err)
	}

	targets, err := s.getTargets(ctx, m.ID)
	if err != nil {
		return nil, err
	}
	m.Targets = targets
	return &m, nil
}

// GetByID retrieves the URLMonitoring (with targets) by its UUID.
func (s *URLMonitoringStore) GetByID(ctx context.Context, id string) (*cloudhub.URLMonitoring, error) {
	const q = `
SELECT id, org_id, collector_server
FROM url_check WHERE id = $1 AND delete_yn = false`

	var m cloudhub.URLMonitoring
	row := s.client.QueryRowContext(ctx, q, id)
	if err := row.Scan(&m.ID, &m.OrgID, &m.CollectorServer); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, cloudhub.ErrURLMonitoringNotFound
		}
		return nil, fmt.Errorf("url_check get by id: %w", err)
	}
	targets, err := s.getTargets(ctx, m.ID)
	if err != nil {
		return nil, err
	}
	m.Targets = targets
	return &m, nil
}

// Update replaces the URLMonitoring settings and targets.
func (s *URLMonitoringStore) Update(ctx context.Context, m *cloudhub.URLMonitoring) (*cloudhub.URLMonitoring, error) {
	now := time.Now()
	m.Targets = normalizeTargets(m.Targets)

	err := s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		const q = `
UPDATE url_check SET
    collector_server = $2,
    updated_at       = $3
WHERE id = $1 AND delete_yn = false`
		result, err := tx.ExecContext(ctx, q,
			m.ID, m.CollectorServer, now,
		)
		if err != nil {
			return fmt.Errorf("url_check update: %w", err)
		}
		if result.RowsAffected() == 0 {
			return cloudhub.ErrURLMonitoringNotFound
		}

		return syncTargets(ctx, tx, m, now)
	})
	if err != nil {
		return nil, err
	}
	return m, nil
}

// syncTargets soft-deletes only targets no longer in the payload, updates rows with ids, and inserts new rows without ids.
// If every target has an empty id (legacy client), replaces all targets: soft-delete active rows then insert.
func syncTargets(ctx context.Context, tx rdb.Store, m *cloudhub.URLMonitoring, now time.Time) error {
	if len(m.Targets) == 0 {
		_, err := tx.ExecContext(ctx,
			`UPDATE url_check_targets SET delete_yn = true, updated_at = $2 WHERE url_check_id = $1 AND delete_yn = false`,
			m.ID, now,
		)
		if err != nil {
			return fmt.Errorf("url_check_targets soft-delete all: %w", err)
		}
		return nil
	}

	allNew := true
	for i := range m.Targets {
		if m.Targets[i].ID != "" {
			allNew = false
			break
		}
	}
	if allNew {
		if _, err := tx.ExecContext(ctx,
			`UPDATE url_check_targets SET delete_yn = true, updated_at = $2 WHERE url_check_id = $1 AND delete_yn = false`,
			m.ID, now,
		); err != nil {
			return fmt.Errorf("url_check_targets soft-delete all: %w", err)
		}
		return insertTargets(ctx, tx, m.ID, m.Targets, now)
	}

	keep := make(map[string]struct{}, len(m.Targets))
	for i := range m.Targets {
		if id := m.Targets[i].ID; id != "" {
			keep[id] = struct{}{}
		}
	}

	rows, err := tx.QueryContext(ctx,
		`SELECT id FROM url_check_targets WHERE url_check_id = $1 AND delete_yn = false`,
		m.ID,
	)
	if err != nil {
		return fmt.Errorf("url_check_targets list active: %w", err)
	}
	defer rows.Close()
	var active []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("url_check_targets scan id: %w", err)
		}
		active = append(active, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, id := range active {
		if _, ok := keep[id]; ok {
			continue
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE url_check_targets SET delete_yn = true, updated_at = $2 WHERE id = $1 AND delete_yn = false`,
			id, now,
		); err != nil {
			return fmt.Errorf("url_check_targets soft-delete removed: %w", err)
		}
	}

	for i := range m.Targets {
		t := &m.Targets[i]
		t.URLMonitoringID = m.ID
		if t.ID == "" {
			if err := insertTarget(ctx, tx, m.ID, t, now); err != nil {
				return err
			}
			continue
		}
		const upd = `
UPDATE url_check_targets SET
    name             = $2,
    url              = $3,
    interval         = $4,
    response_timeout = $5,
    method           = $6,
    updated_at       = $7
WHERE id = $1 AND url_check_id = $8 AND delete_yn = false`
		res, err := tx.ExecContext(ctx, upd,
			t.ID, t.Name, t.URL, t.Interval, t.ResponseTimeout, t.Method, now, m.ID,
		)
		if err != nil {
			return fmt.Errorf("url_check_targets update: %w", err)
		}
		if res.RowsAffected() == 0 {
			return fmt.Errorf("url_check_targets update: target id %q not found for this monitoring", t.ID)
		}
	}
	return nil
}

// Delete soft-deletes the URLMonitoring by its UUID and soft-deletes all active targets in the same transaction.
func (s *URLMonitoringStore) Delete(ctx context.Context, id string) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx,
			`UPDATE url_check_targets SET delete_yn = true, updated_at = now()
			 WHERE url_check_id = $1 AND delete_yn = false`,
			id,
		); err != nil {
			return fmt.Errorf("url_check_targets cascade soft-delete: %w", err)
		}
		result, err := tx.ExecContext(ctx,
			`UPDATE url_check SET delete_yn = true, updated_at = now() WHERE id = $1 AND delete_yn = false`,
			id,
		)
		if err != nil {
			return fmt.Errorf("url_check delete: %w", err)
		}
		if result.RowsAffected() == 0 {
			return cloudhub.ErrURLMonitoringNotFound
		}
		return nil
	})
}

// getTargets fetches active targets for the given url_check ID.
func (s *URLMonitoringStore) getTargets(ctx context.Context, monitoringID string) ([]cloudhub.URLMonitoringTarget, error) {
	const q = `
SELECT id, url_check_id, name, url, interval, response_timeout, method
FROM url_check_targets
WHERE url_check_id = $1 AND delete_yn = false
ORDER BY created_at ASC`

	rows, err := s.client.QueryContext(ctx, q, monitoringID)
	if err != nil {
		return nil, fmt.Errorf("url_check_targets get: %w", err)
	}
	defer rows.Close()

	var targets []cloudhub.URLMonitoringTarget
	for rows.Next() {
		var t cloudhub.URLMonitoringTarget
		if err := rows.Scan(&t.ID, &t.URLMonitoringID, &t.Name, &t.URL,
			&t.Interval, &t.ResponseTimeout, &t.Method); err != nil {
			return nil, fmt.Errorf("url_check_targets scan: %w", err)
		}
		targets = append(targets, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range targets {
		qMap := `SELECT alert_rule_id FROM alert_rule_urls WHERE url_target_id = $1`
		mRows, err := s.client.QueryContext(ctx, qMap, targets[i].ID)
		if err != nil {
			// Ignore mapping error if table doesn't exist
			continue
		}
		for mRows.Next() {
			var rID string
			if err := mRows.Scan(&rID); err == nil {
				targets[i].AlertRuleIDs = append(targets[i].AlertRuleIDs, rID)
			}
		}
		mRows.Close()
	}

	return targets, nil
}

// insertTargets inserts a slice of targets for the given url_check ID.
func insertTargets(ctx context.Context, tx rdb.Store, monitoringID string, targets []cloudhub.URLMonitoringTarget, now time.Time) error {
	for i := range targets {
		targets[i].URLMonitoringID = monitoringID
		if err := insertTarget(ctx, tx, monitoringID, &targets[i], now); err != nil {
			return err
		}
	}
	return nil
}

func insertTarget(ctx context.Context, tx rdb.Store, monitoringID string, t *cloudhub.URLMonitoringTarget, now time.Time) error {
	const q = `
INSERT INTO url_check_targets (url_check_id, name, url, interval, response_timeout, method, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id`
	row := tx.QueryRowContext(ctx, q,
		monitoringID, t.Name, t.URL, t.Interval, t.ResponseTimeout, t.Method, now, now,
	)
	if err := row.Scan(&t.ID); err != nil {
		return fmt.Errorf("url_check_targets insert: %w", err)
	}
	return nil
}

// normalizeTargets ensures Targets is never nil.
func normalizeTargets(targets []cloudhub.URLMonitoringTarget) []cloudhub.URLMonitoringTarget {
	if targets == nil {
		return []cloudhub.URLMonitoringTarget{}
	}
	return targets
}
