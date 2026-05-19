package pgsql

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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

const alertRuleCols = `id, org_id, kapacitor_id, name, database, retention_policy, measurement, field, trigger_operator, rule_trigger, task_type, every, occurrence_type, occurrence_count, occurrence_window, pause_seconds, notify_recovery, message, active, delete_yn, created_at, updated_at`

func (s *AlertRuleStore) scan(row interface{ Scan(...any) error }) (cloudhub.AlertGroupRule, error) {
	var r cloudhub.AlertGroupRule
	var ca, ua time.Time
	if err := row.Scan(
		&r.ID, &r.OrgID, &r.KapacitorID, &r.Name, &r.Database, &r.RetentionPolicy,
		&r.Measurement, &r.Field,
		&r.TriggerOperator, &r.Trigger, &r.TaskType, &r.Every, &r.OccurrenceType, &r.OccurrenceCount,
		&r.OccurrenceWindow, &r.PauseSeconds, &r.NotifyRecovery, &r.Message, &r.Active,
		&r.DeleteYN, &ca, &ua,
	); err != nil {
		return r, fmt.Errorf("alert_rule scan: %w", err)
	}
	r.CreatedAt, r.UpdatedAt = ca, ua
	return r, nil
}

func (s *AlertRuleStore) All(ctx context.Context, orgID string) ([]cloudhub.AlertGroupRule, error) {
	q := `SELECT ` + alertRuleCols + ` FROM alert_rules WHERE org_id = $1 AND delete_yn = false ORDER BY created_at`
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
		if r.Conditions, err = s.ConditionsByRule(ctx, r.ID); err != nil {
			return nil, err
		}
		if r.TriggerValues, err = s.TriggerValuesByRule(ctx, r.ID); err != nil {
			return nil, err
		}
		if r.Hostnames, err = s.hostnamesOf(ctx, r.ID); err != nil {
			return nil, err
		}
		if r.RecipientGroupIDs, err = s.recipientGroupIDs(ctx, r.ID); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *AlertRuleStore) Get(ctx context.Context, id string) (cloudhub.AlertGroupRule, error) {
	q := `SELECT ` + alertRuleCols + ` FROM alert_rules WHERE id = $1 AND delete_yn = false`
	row := s.client.QueryRowContext(ctx, q, id)
	r, err := s.scan(row)
	if err != nil {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Get: %w", err)
	}
	if r.Conditions, err = s.ConditionsByRule(ctx, id); err != nil {
		return r, err
	}
	if r.TriggerValues, err = s.TriggerValuesByRule(ctx, id); err != nil {
		return r, err
	}
	if r.Hostnames, err = s.hostnamesOf(ctx, id); err != nil {
		return r, err
	}
	r.RecipientGroupIDs, err = s.recipientGroupIDs(ctx, id)
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

func (s *AlertRuleStore) Add(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
	const q = `INSERT INTO alert_rules (
		org_id, kapacitor_id, name, database, retention_policy, measurement, field,
		trigger_operator, rule_trigger, task_type, every, occurrence_type, occurrence_count, occurrence_window,
		pause_seconds, notify_recovery, message, active
	) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
	RETURNING id, created_at, updated_at`
	var ca, ua time.Time
	if err := s.client.QueryRowContext(ctx, q,
		r.OrgID, r.KapacitorID, r.Name, r.Database, r.RetentionPolicy, r.Measurement, r.Field,
		r.TriggerOperator, normalizeAlertRuleTrigger(r.Trigger), r.TaskType, r.Every,
		r.OccurrenceType, r.OccurrenceCount, r.OccurrenceWindow,
		r.PauseSeconds, r.NotifyRecovery, r.Message, r.Active,
	).Scan(&r.ID, &ca, &ua); err != nil {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Add: %w", err)
	}
	r.CreatedAt, r.UpdatedAt = ca, ua

	if len(r.Conditions) > 0 {
		if err := s.SetConditions(ctx, r.ID, r.Conditions); err != nil {
			return r, err
		}
	}
	if shouldStoreTriggerValues(r) {
		if err := s.SetTriggerValues(ctx, r.ID, r.TriggerValues); err != nil {
			return r, err
		}
	}
	return r, nil
}

func (s *AlertRuleStore) Update(ctx context.Context, r cloudhub.AlertGroupRule) error {
	const q = `UPDATE alert_rules SET
		kapacitor_id=$1, name=$2, database=$3, retention_policy=$4, measurement=$5, field=$6,
		trigger_operator=$7, rule_trigger=$8, task_type=$9, every=$10,
		occurrence_type=$11, occurrence_count=$12, occurrence_window=$13,
		pause_seconds=$14, notify_recovery=$15, message=$16, active=$17,
		updated_at=NOW()
	WHERE id=$18 AND delete_yn = false`
	if _, err := s.client.ExecContext(ctx, q,
		r.KapacitorID, r.Name, r.Database, r.RetentionPolicy, r.Measurement, r.Field,
		r.TriggerOperator, normalizeAlertRuleTrigger(r.Trigger), r.TaskType, r.Every,
		r.OccurrenceType, r.OccurrenceCount, r.OccurrenceWindow,
		r.PauseSeconds, r.NotifyRecovery, r.Message, r.Active,
		r.ID,
	); err != nil {
		return fmt.Errorf("alert_rule.Update: %w", err)
	}
	if shouldStoreTriggerValues(r) {
		if err := s.SetTriggerValues(ctx, r.ID, r.TriggerValues); err != nil {
			return err
		}
	} else if err := s.DeleteTriggerValues(ctx, r.ID); err != nil {
		return err
	}
	return nil
}

func (s *AlertRuleStore) Delete(ctx context.Context, id string) error {
	if _, err := s.client.ExecContext(ctx, `UPDATE alert_rules SET delete_yn = true, updated_at = NOW() WHERE id = $1`, id); err != nil {
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

// Hostnames returns all hostnames directly assigned to a rule.
// Returns empty slice when no hosts assigned (= all-hosts mode).
func (s *AlertRuleStore) Hostnames(ctx context.Context, ruleID string) ([]string, error) {
	return s.hostnamesOf(ctx, ruleID)
}

func shouldStoreTriggerValues(r cloudhub.AlertGroupRule) bool {
	trigger := normalizeAlertRuleTrigger(r.Trigger)
	v := r.TriggerValues
	return trigger == cloudhub.AlertGroupRuleTriggerRelative ||
		trigger == cloudhub.AlertGroupRuleTriggerDeadman ||
		v.Change != "" || v.Period != "" || v.Shift != "" || v.Operator != "" ||
		v.Value != "" || v.RangeValue != ""
}

func (s *AlertRuleStore) TriggerValuesByRule(ctx context.Context, ruleID string) (cloudhub.TriggerValues, error) {
	row := s.client.QueryRowContext(ctx, `
		SELECT change, period, shift, operator, value, range_value
	FROM alert_rule_trigger_values
	WHERE alert_rule_id = $1`, ruleID)
	var v cloudhub.TriggerValues
	if err := row.Scan(&v.Change, &v.Period, &v.Shift, &v.Operator, &v.Value, &v.RangeValue); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return cloudhub.TriggerValues{}, nil
		}
		return v, fmt.Errorf("alert_rule.TriggerValuesByRule: %w", err)
	}
	return v, nil
}

func (s *AlertRuleStore) SetTriggerValues(ctx context.Context, ruleID string, v cloudhub.TriggerValues) error {
	_, err := s.client.ExecContext(ctx, `
		INSERT INTO alert_rule_trigger_values
			(alert_rule_id, change, period, shift, operator, value, range_value)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (alert_rule_id) DO UPDATE SET
			change = EXCLUDED.change,
			period = EXCLUDED.period,
			shift = EXCLUDED.shift,
			operator = EXCLUDED.operator,
			value = EXCLUDED.value,
			range_value = EXCLUDED.range_value`,
		ruleID, v.Change, v.Period, v.Shift, v.Operator, v.Value, v.RangeValue)
	if err != nil {
		return fmt.Errorf("alert_rule.SetTriggerValues: %w", err)
	}
	return nil
}

func (s *AlertRuleStore) DeleteTriggerValues(ctx context.Context, ruleID string) error {
	if _, err := s.client.ExecContext(ctx, `DELETE FROM alert_rule_trigger_values WHERE alert_rule_id = $1`, ruleID); err != nil {
		return fmt.Errorf("alert_rule.DeleteTriggerValues: %w", err)
	}
	return nil
}

func (s *AlertRuleStore) recipientGroupIDs(ctx context.Context, ruleID string) ([]string, error) {
	rows, err := s.client.QueryContext(ctx, `SELECT recipient_group_id FROM alert_rule_recipient_groups WHERE alert_rule_id = $1`, ruleID)
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

func (s *AlertRuleStore) SetRecipientGroups(ctx context.Context, ruleID string, groupIDs []string) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_recipient_groups WHERE alert_rule_id = $1`, ruleID); err != nil {
			return err
		}
		for _, gid := range groupIDs {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO alert_rule_recipient_groups (alert_rule_id, recipient_group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
				ruleID, gid); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *AlertRuleStore) RecipientGroupsByRule(ctx context.Context, ruleID string) ([]cloudhub.RecipientGroup, error) {
	ids, err := s.recipientGroupIDs(ctx, ruleID)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, nil
	}
	rgStore := NewRecipientGroupStore(s.client)
	var out []cloudhub.RecipientGroup
	for _, gid := range ids {
		g, err := rgStore.Get(ctx, gid)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, nil
}

func (s *AlertRuleStore) RulesByRecipientGroup(ctx context.Context, recipientGroupID string) ([]cloudhub.AlertGroupRule, error) {
	const q = `SELECT alert_rule_id FROM alert_rule_recipient_groups WHERE recipient_group_id = $1`
	rows, err := s.client.QueryContext(ctx, q, recipientGroupID)
	if err != nil {
		return nil, fmt.Errorf("alert_rule.RulesByRecipientGroup: %w", err)
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

// ConditionsByRule delegates to AlertRuleConditionStore so AlertGroupRuleStore
// can be satisfied without a second store handle in callers.
func (s *AlertRuleStore) ConditionsByRule(ctx context.Context, ruleID string) ([]cloudhub.AlertRuleCondition, error) {
	return NewAlertRuleConditionStore(s.client).ByRule(ctx, ruleID)
}

func (s *AlertRuleStore) SetConditions(ctx context.Context, ruleID string, conditions []cloudhub.AlertRuleCondition) error {
	return NewAlertRuleConditionStore(s.client).SetForRule(ctx, ruleID, conditions)
}
