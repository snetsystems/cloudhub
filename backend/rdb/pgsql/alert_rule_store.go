package pgsql

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

var _ cloudhub.AlertGroupRuleStore = (*AlertRuleStore)(nil)

// AlertRuleStore manages AlertGroupRule persistence in PostgreSQL.
type AlertRuleStore struct{ client *Client }

// NewAlertRuleStore creates a new AlertRuleStore.
func NewAlertRuleStore(client *Client) *AlertRuleStore {
	return &AlertRuleStore{client: client}
}

// RawClient exposes the underlying client for one-off admin scripts.
func (s *AlertRuleStore) RawClient() *Client { return s.client }

func normalizeAlertRuleTrigger(t string) string {
	t = strings.TrimSpace(strings.ToLower(t))
	if t == "" {
		return cloudhub.AlertGroupRuleTriggerThreshold
	}
	return t
}

const alertRuleCols = `id, org_id, kapacitor_id, name, database, retention_policy, measurement, field, conditions, trigger_operator, rule_trigger, task_type, every, occurrence_type, occurrence_count, occurrence_window, pause_seconds, notify_recovery, message, active, recipients, created_at, updated_at`

func (s *AlertRuleStore) scan(row interface{ Scan(...any) error }) (cloudhub.AlertGroupRule, error) {
	var r cloudhub.AlertGroupRule
	var condJSON, recipientsJSON []byte
	var ca, ua time.Time
	if err := row.Scan(&r.ID, &r.OrgID, &r.KapacitorID, &r.Name, &r.Database, &r.RetentionPolicy,
		&r.Measurement, &r.Field, &condJSON,
		&r.TriggerOperator, &r.Trigger, &r.TaskType, &r.Every, &r.OccurrenceType, &r.OccurrenceCount,
		&r.OccurrenceWindow, &r.PauseSeconds, &r.NotifyRecovery, &r.Message, &r.Active,
		&recipientsJSON, &ca, &ua); err != nil {
		return r, fmt.Errorf("alert_rule scan: %w", err)
	}
	r.CreatedAt, r.UpdatedAt = ca, ua
	if err := json.Unmarshal(condJSON, &r.Conditions); err != nil {
		return r, fmt.Errorf("alert_rule conditions unmarshal: %w", err)
	}
	if len(recipientsJSON) > 0 {
		if err := json.Unmarshal(recipientsJSON, &r.Recipients); err != nil {
			return r, fmt.Errorf("alert_rule recipients unmarshal: %w", err)
		}
	}
	return r, nil
}

func (s *AlertRuleStore) All(ctx context.Context, orgID string) ([]cloudhub.AlertGroupRule, error) {
	q := `SELECT ` + alertRuleCols + ` FROM alert_rules WHERE org_id = $1 ORDER BY created_at`
	rows, err := s.client.QueryContext(ctx, q, orgID)
	if err != nil {
		return nil, fmt.Errorf("alert_rule.All: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.AlertGroupRule
	for rows.Next() {
		r, err := s.scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *AlertRuleStore) Get(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
	q := `SELECT ` + alertRuleCols + ` FROM alert_rules WHERE id = $1`
	rows, err := s.client.QueryContext(ctx, q, id)
	if err != nil {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Get: %w", err)
	}
	defer rows.Close()
	if !rows.Next() {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Get: not found")
	}
	r, err := s.scan(rows)
	if err != nil {
		return cloudhub.AlertGroupRule{}, err
	}
	r.Hostnames, err = s.hostnamesOf(ctx, id)
	if err != nil {
		return r, err
	}
	r.UserGroupIDs, err = s.userGroupIDs(ctx, id)
	return r, err
}

func (s *AlertRuleStore) hostnamesOf(ctx context.Context, ruleID string) ([]string, error) {
	rows, err := s.client.QueryContext(ctx, `SELECT hostname FROM alert_rule_hosts WHERE alert_rule_id = $1`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

func (s *AlertRuleStore) userGroupIDs(ctx context.Context, ruleID string) ([]string, error) {
	rows, err := s.client.QueryContext(ctx, `SELECT user_group_id FROM alert_rule_user_groups WHERE alert_rule_id = $1`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *AlertRuleStore) Add(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
	condJSON, err := json.Marshal(r.Conditions)
	if err != nil {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Add marshal: %w", err)
	}
	if r.Conditions == nil {
		condJSON = []byte("[]")
	}
	recipientsJSON, err := json.Marshal(r.Recipients)
	if err != nil {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Add recipients marshal: %w", err)
	}
	if r.Recipients == nil {
		recipientsJSON = []byte("[]")
	}
	const q = `INSERT INTO alert_rules (org_id, kapacitor_id, name, database, retention_policy, measurement, field, conditions, trigger_operator, rule_trigger, task_type, every, occurrence_type, occurrence_count, occurrence_window, pause_seconds, notify_recovery, message, active, recipients, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW()) RETURNING id, created_at, updated_at`
	var ca, ua time.Time
	if err := s.client.QueryRowContext(ctx, q,
		r.OrgID, r.KapacitorID, r.Name, r.Database, r.RetentionPolicy, r.Measurement, r.Field, condJSON,
		r.TriggerOperator, normalizeAlertRuleTrigger(r.Trigger), r.TaskType, r.Every,
		r.OccurrenceType, r.OccurrenceCount, r.OccurrenceWindow,
		r.PauseSeconds, r.NotifyRecovery, r.Message, r.Active, recipientsJSON,
	).Scan(&r.ID, &ca, &ua); err != nil {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Add: %w", err)
	}
	r.CreatedAt, r.UpdatedAt = ca, ua
	return r, nil
}

func (s *AlertRuleStore) Update(ctx context.Context, r cloudhub.AlertGroupRule) error {
	condJSON, err := json.Marshal(r.Conditions)
	if err != nil {
		return fmt.Errorf("alert_rule.Update marshal: %w", err)
	}
	recipientsJSON, err := json.Marshal(r.Recipients)
	if err != nil {
		return fmt.Errorf("alert_rule.Update recipients marshal: %w", err)
	}
	if r.Recipients == nil {
		recipientsJSON = []byte("[]")
	}
	const q = `UPDATE alert_rules SET kapacitor_id=$1, name=$2, database=$3, retention_policy=$4, measurement=$5, field=$6, conditions=$7, trigger_operator=$8, rule_trigger=$9, task_type=$10, every=$11, occurrence_type=$12, occurrence_count=$13, occurrence_window=$14, pause_seconds=$15, notify_recovery=$16, message=$17, active=$18, recipients=$19, updated_at=NOW() WHERE id=$20`
	if _, err := s.client.ExecContext(ctx, q,
		r.KapacitorID, r.Name, r.Database, r.RetentionPolicy, r.Measurement, r.Field, condJSON,
		r.TriggerOperator, normalizeAlertRuleTrigger(r.Trigger), r.TaskType, r.Every,
		r.OccurrenceType, r.OccurrenceCount, r.OccurrenceWindow,
		r.PauseSeconds, r.NotifyRecovery, r.Message, r.Active, recipientsJSON, r.ID,
	); err != nil {
		return fmt.Errorf("alert_rule.Update: %w", err)
	}
	return nil
}

func (s *AlertRuleStore) Delete(ctx context.Context, id string) error {
	if _, err := s.client.ExecContext(ctx, `DELETE FROM alert_rules WHERE id = $1`, id); err != nil {
		return fmt.Errorf("alert_rule.Delete: %w", err)
	}
	return nil
}

func (s *AlertRuleStore) SetHosts(ctx context.Context, ruleID string, hostnames []string) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_hosts WHERE alert_rule_id = $1`, ruleID); err != nil {
			return err
		}
		for _, name := range hostnames {
			if name == "" {
				continue
			}
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO alert_rule_hosts (alert_rule_id, hostname) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
				ruleID, name); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *AlertRuleStore) SetUserGroups(ctx context.Context, ruleID string, userGroupIDs []string) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_user_groups WHERE alert_rule_id = $1`, ruleID); err != nil {
			return err
		}
		for _, gid := range userGroupIDs {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO alert_rule_user_groups (alert_rule_id, user_group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
				ruleID, gid); err != nil {
				return err
			}
		}
		return nil
	})
}

// Hostnames returns all hostnames directly assigned to a rule.
// Returns empty slice when no hosts assigned (= all-hosts mode).
func (s *AlertRuleStore) Hostnames(ctx context.Context, ruleID string) ([]string, error) {
	return s.hostnamesOf(ctx, ruleID)
}

// UserGroupsByRule returns all user_groups directly linked to a rule via alert_rule_user_groups.
// Empty list means no recipient groups assigned (직접 수신자만 사용 — 빈 대상으로 발송 안 함).
func (s *AlertRuleStore) UserGroupsByRule(ctx context.Context, ruleID string) ([]cloudhub.UserGroup, error) {
	ids, err := s.userGroupIDs(ctx, ruleID)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, nil
	}
	ugStore := NewUserGroupStore(s.client)
	var out []cloudhub.UserGroup
	for _, gid := range ids {
		g, err := ugStore.Get(ctx, gid)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, nil
}

// RulesByUserGroup returns all alert rules linked to a user_group via alert_rule_user_groups.
func (s *AlertRuleStore) RulesByUserGroup(ctx context.Context, userGroupID string) ([]cloudhub.AlertGroupRule, error) {
	const q = `SELECT alert_rule_id FROM alert_rule_user_groups WHERE user_group_id = $1`
	rows, err := s.client.QueryContext(ctx, q, userGroupID)
	if err != nil {
		return nil, fmt.Errorf("alert_rule.RulesByUserGroup: %w", err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var out []cloudhub.AlertGroupRule
	for _, id := range ids {
		r, err := s.Get(ctx, id)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}
