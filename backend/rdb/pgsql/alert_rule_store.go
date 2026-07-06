package pgsql

import (
	"context"
	"encoding/json"
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

const alertRuleCols = `id, org_id, kapacitor_id, name, task_type, occurrence_type, occurrence_count, occurrence_window, pause_seconds, notify_recovery, message, active, derivative_enabled, derivative_non_negative, derivative_unit, eval_expression, eval_as, delete_yn, created_at, updated_at`

func (s *AlertRuleStore) scan(row interface{ Scan(...any) error }) (cloudhub.AlertGroupRule, error) {
	var r cloudhub.AlertGroupRule
	var ca, ua time.Time
	var derivativeEnabled, derivativeNonNegative bool
	var derivativeUnit, evalExpression, evalAs string
	if err := row.Scan(
		&r.ID, &r.OrgID, &r.KapacitorID, &r.Name,
		&r.TaskType, &r.OccurrenceType, &r.OccurrenceCount,
		&r.OccurrenceWindow, &r.PauseSeconds, &r.NotifyRecovery, &r.Message, &r.Active,
		&derivativeEnabled, &derivativeNonNegative, &derivativeUnit, &evalExpression, &evalAs,
		&r.DeleteYN, &ca, &ua,
	); err != nil {
		return r, fmt.Errorf("alert_rule scan: %w", err)
	}
	r.CreatedAt, r.UpdatedAt = ca, ua
	// Derivative is nil unless the row marked it enabled.
	if derivativeEnabled {
		r.Derivative = &cloudhub.DerivativeConfig{
			Enabled:     true,
			NonNegative: derivativeNonNegative,
			Unit:        derivativeUnit,
		}
	}
	// Eval is nil unless both expression and alias are present
	if evalExpression != "" && evalAs != "" {
		r.Eval = &cloudhub.EvalConfig{Expression: evalExpression, As: evalAs}
	}
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
		if r.Specs, err = s.SpecsByRule(ctx, r.ID); err != nil {
			return nil, err
		}
		if r.Hostnames, err = s.Hostnames(ctx, r.ID); err != nil {
			return nil, err
		}
		if r.URLTargetIDs, err = s.URLTargetIDs(ctx, r.ID); err != nil {
			return nil, err
		}
		if r.EventHandlers, err = s.EventHandlersByRule(ctx, r.ID); err != nil {
			return nil, err
		}
		r.RecipientGroupIDs = emailRecipientGroupIDs(r.EventHandlers)
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
	if r.Specs, err = s.SpecsByRule(ctx, id); err != nil {
		return r, err
	}
	if r.Hostnames, err = s.Hostnames(ctx, id); err != nil {
		return r, err
	}
	if r.URLTargetIDs, err = s.URLTargetIDs(ctx, id); err != nil {
		return r, err
	}
	r.EventHandlers, err = s.EventHandlersByRule(ctx, id)
	r.RecipientGroupIDs = emailRecipientGroupIDs(r.EventHandlers)
	return r, err
}

func (s *AlertRuleStore) Add(ctx context.Context, r cloudhub.AlertGroupRule) (cloudhub.AlertGroupRule, error) {
	const q = `INSERT INTO alert_rules (
		org_id, kapacitor_id, name, task_type, occurrence_type, occurrence_count, occurrence_window,
		pause_seconds, notify_recovery, message, active,
		derivative_enabled, derivative_non_negative, derivative_unit, eval_expression, eval_as
	) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
	RETURNING id, created_at, updated_at`
	var ca, ua time.Time
	derEnabled, derNonNegative, derUnit := splitDerivative(r.Derivative)
	evalExpression, evalAs := splitEval(r.Eval)
	if err := s.client.QueryRowContext(ctx, q,
		r.OrgID, r.KapacitorID, r.Name, r.TaskType,
		r.OccurrenceType, r.OccurrenceCount, r.OccurrenceWindow,
		r.PauseSeconds, r.NotifyRecovery, r.Message, r.Active,
		derEnabled, derNonNegative, derUnit, evalExpression, evalAs,
	).Scan(&r.ID, &ca, &ua); err != nil {
		return cloudhub.AlertGroupRule{}, fmt.Errorf("alert_rule.Add: %w", err)
	}
	r.CreatedAt, r.UpdatedAt = ca, ua

	if err := s.SetSpecs(ctx, r.ID, r.Specs); err != nil {
		return r, err
	}
	return r, nil
}

func (s *AlertRuleStore) Update(ctx context.Context, r cloudhub.AlertGroupRule) error {
	const q = `UPDATE alert_rules SET
		kapacitor_id=$1, name=$2, task_type=$3,
		occurrence_type=$4, occurrence_count=$5, occurrence_window=$6,
		pause_seconds=$7, notify_recovery=$8, message=$9, active=$10,
		derivative_enabled=$11, derivative_non_negative=$12, derivative_unit=$13,
		eval_expression=$14, eval_as=$15,
		updated_at=NOW()
	WHERE id=$16 AND delete_yn = false`
	derEnabled, derNonNegative, derUnit := splitDerivative(r.Derivative)
	evalExpression, evalAs := splitEval(r.Eval)
	if _, err := s.client.ExecContext(ctx, q,
		r.KapacitorID, r.Name, r.TaskType,
		r.OccurrenceType, r.OccurrenceCount, r.OccurrenceWindow,
		r.PauseSeconds, r.NotifyRecovery, r.Message, r.Active,
		derEnabled, derNonNegative, derUnit, evalExpression, evalAs,
		r.ID,
	); err != nil {
		return fmt.Errorf("alert_rule.Update: %w", err)
	}
	if err := s.SetSpecs(ctx, r.ID, r.Specs); err != nil {
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

// target methods
func (s *AlertRuleStore) Hostnames(ctx context.Context, ruleID string) ([]string, error) {
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

func (s *AlertRuleStore) URLTargetIDs(ctx context.Context, ruleID string) ([]string, error) {
	rows, err := s.client.QueryContext(ctx, `SELECT url_target_id FROM alert_rule_urls WHERE alert_rule_id = $1`, ruleID)
	if err != nil {
		// table might not exist yet if migrations failed, but assuming it exists
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

func (s *AlertRuleStore) SetURLTargets(ctx context.Context, ruleID string, urlTargetIDs []string) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_urls WHERE alert_rule_id = $1`, ruleID); err != nil {
			return err
		}
		for _, id := range urlTargetIDs {
			if id == "" {
				continue
			}
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO alert_rule_urls (alert_rule_id, url_target_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
				ruleID, id); err != nil {
				return err
			}
		}
		return nil
	})
}

// splitDerivative flattens a *DerivativeConfig into the three persisted column
// values, normalizing the inactive case to (false, true, ""). Defaults match
// the migration's column defaults.
func splitDerivative(d *cloudhub.DerivativeConfig) (enabled, nonNegative bool, unit string) {
	if d == nil || !d.Enabled {
		return false, true, ""
	}
	return true, d.NonNegative, strings.TrimSpace(d.Unit)
}

// splitEval flattens a *EvalConfig into the two persisted column values.
// Empty pair = inactive (matches migration defaults).
func splitEval(e *cloudhub.EvalConfig) (expression, as string) {
	if e == nil {
		return "", ""
	}
	exp := strings.TrimSpace(e.Expression)
	alias := strings.TrimSpace(e.As)
	if exp == "" || alias == "" {
		return "", ""
	}
	return exp, alias
}

func normalizeAlertRuleTrigger(t string) string {
	t = strings.TrimSpace(strings.ToLower(t))
	if t == "" {
		return cloudhub.AlertGroupRuleTriggerThreshold
	}
	return t
}

func (s *AlertRuleStore) SpecsByRule(ctx context.Context, ruleID string) ([]cloudhub.AlertRuleSpec, error) {
	q := `SELECT id, database, retention_policy, measurement, field, rule_trigger, every, delete_yn, created_at, updated_at
		  FROM alert_rule_specs WHERE alert_rule_id = $1 AND delete_yn = false ORDER BY created_at`
	rows, err := s.client.QueryContext(ctx, q, ruleID)
	if err != nil {
		return nil, fmt.Errorf("alert_rule.SpecsByRule: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.AlertRuleSpec
	for rows.Next() {
		var sp cloudhub.AlertRuleSpec
		sp.AlertRuleID = ruleID
		if err := rows.Scan(
			&sp.ID, &sp.Database, &sp.RetentionPolicy, &sp.Measurement, &sp.Field,
			&sp.Trigger, &sp.Every, &sp.DeleteYN, &sp.CreatedAt, &sp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, sp)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i, sp := range out {
		if out[i].Conditions, err = s.conditionsBySpec(ctx, sp.ID); err != nil {
			return nil, err
		}
		if out[i].TriggerValues, err = s.triggerValuesBySpec(ctx, sp.ID); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (s *AlertRuleStore) conditionsBySpec(ctx context.Context, specID string) ([]cloudhub.AlertRuleCondition, error) {
	q := `SELECT level, value, operator, enabled FROM alert_rule_conditions WHERE alert_rule_spec_id = $1 ORDER BY level`
	rows, err := s.client.QueryContext(ctx, q, specID)
	if err != nil {
		return nil, fmt.Errorf("alert_rule.conditionsBySpec: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.AlertRuleCondition
	for rows.Next() {
		var c cloudhub.AlertRuleCondition
		if err := rows.Scan(&c.Level, &c.Value, &c.Operator, &c.Enabled); err != nil {
			return nil, err
		}
		c.Operator = cloudhub.NormalizeAlertConditionOperator(c.Operator)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *AlertRuleStore) triggerValuesBySpec(ctx context.Context, specID string) (*cloudhub.TriggerValues, error) {
	row := s.client.QueryRowContext(ctx, `
		SELECT change, period, shift, operator, value, range_value
	FROM alert_rule_trigger_values
	WHERE alert_rule_spec_id = $1`, specID)
	var v cloudhub.TriggerValues
	if err := row.Scan(&v.Change, &v.Period, &v.Shift, &v.Operator, &v.Value, &v.RangeValue); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("alert_rule.triggerValuesBySpec: %w", err)
	}
	return &v, nil
}

func (s *AlertRuleStore) SetSpecs(ctx context.Context, ruleID string, specs []cloudhub.AlertRuleSpec) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `UPDATE alert_rule_specs SET delete_yn = true, updated_at = NOW() WHERE alert_rule_id = $1`, ruleID); err != nil {
			return err
		}
		for _, sp := range specs {
			var specID string
			if sp.ID == "" {
				q := `INSERT INTO alert_rule_specs (alert_rule_id, database, retention_policy, measurement, field, rule_trigger, every)
					  VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`
				if err := tx.QueryRowContext(ctx, q, ruleID, sp.Database, sp.RetentionPolicy, sp.Measurement, sp.Field, normalizeAlertRuleTrigger(sp.Trigger), sp.Every).Scan(&specID); err != nil {
					return err
				}
			} else {
				q := `UPDATE alert_rule_specs SET database=$1, retention_policy=$2, measurement=$3, field=$4, rule_trigger=$5, every=$6, delete_yn=false, updated_at=NOW() WHERE id=$7 RETURNING id`
				if err := tx.QueryRowContext(ctx, q, sp.Database, sp.RetentionPolicy, sp.Measurement, sp.Field, normalizeAlertRuleTrigger(sp.Trigger), sp.Every, sp.ID).Scan(&specID); err != nil {
					return err
				}
			}
			
			if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_conditions WHERE alert_rule_spec_id = $1`, specID); err != nil {
				return err
			}
			for _, c := range sp.Conditions {
				operator := cloudhub.NormalizeAlertConditionOperator(c.Operator)
				if _, err := tx.ExecContext(ctx,
					`INSERT INTO alert_rule_conditions (alert_rule_spec_id, level, value, operator, enabled) VALUES ($1,$2,$3,$4,$5)`,
					specID, c.Level, c.Value, operator, c.Enabled,
				); err != nil {
					return err
				}
			}
			
			if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_trigger_values WHERE alert_rule_spec_id = $1`, specID); err != nil {
				return err
			}
			if sp.TriggerValues != nil {
				v := sp.TriggerValues
				_, err := tx.ExecContext(ctx, `
					INSERT INTO alert_rule_trigger_values
						(alert_rule_spec_id, change, period, shift, operator, value, range_value)
					VALUES ($1,$2,$3,$4,$5,$6,$7)`,
					specID, v.Change, v.Period, v.Shift, v.Operator, v.Value, v.RangeValue)
				if err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// EventHandlers
func (s *AlertRuleStore) eventHandlerRecipientGroupIDs(ctx context.Context, handlerID string) ([]string, error) {
	rows, err := s.client.QueryContext(ctx, `SELECT recipient_group_id FROM alert_rule_event_handler_recipient_groups WHERE alert_rule_event_handler_id = $1 ORDER BY recipient_group_id`, handlerID)
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

func (s *AlertRuleStore) SetEventHandlers(ctx context.Context, ruleID string, handlers []cloudhub.AlertRuleEventHandler) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_event_handlers WHERE alert_rule_id = $1`, ruleID); err != nil {
			return err
		}
		for _, h := range handlers {
			handlerType := strings.TrimSpace(strings.ToLower(h.Type))
			if handlerType == "" {
				continue
			}
			cfg := h.ConfigJSON
			if len(cfg) == 0 {
				cfg = json.RawMessage(`{}`)
			}
			var handlerID string
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO alert_rule_event_handlers (alert_rule_id, handler_type, enabled, config_json)
				 VALUES ($1,$2,$3,$4)`,
				ruleID, handlerType, h.Enabled, string(cfg)); err != nil {
				return err
			}
			if err := tx.QueryRowContext(ctx,
				`SELECT id FROM alert_rule_event_handlers WHERE alert_rule_id = $1 AND handler_type = $2 AND delete_yn = false`,
				ruleID, handlerType).Scan(&handlerID); err != nil {
				return err
			}
			if eventHandlerUsesRecipientGroups(handlerType) {
				for _, gid := range h.RecipientGroupIDs {
					if strings.TrimSpace(gid) == "" {
						continue
					}
					if _, err := tx.ExecContext(ctx,
						`INSERT INTO alert_rule_event_handler_recipient_groups (alert_rule_event_handler_id, recipient_group_id)
						 VALUES ($1,$2) ON CONFLICT DO NOTHING`,
						handlerID, gid); err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}

func eventHandlerUsesRecipientGroups(handlerType string) bool {
	switch handlerType {
	case cloudhub.AlertRuleEventHandlerEmail, cloudhub.AlertRuleEventHandlerSMS:
		return true
	default:
		return false
	}
}

func (s *AlertRuleStore) EventHandlersByRule(ctx context.Context, ruleID string) ([]cloudhub.AlertRuleEventHandler, error) {
	rows, err := s.client.QueryContext(ctx, `
		SELECT id, alert_rule_id, handler_type, enabled, config_json, created_at, updated_at
		FROM alert_rule_event_handlers
		WHERE alert_rule_id = $1 AND delete_yn = false
		ORDER BY created_at`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []cloudhub.AlertRuleEventHandler
	for rows.Next() {
		var h cloudhub.AlertRuleEventHandler
		var cfg string
		if err := rows.Scan(&h.ID, &h.AlertRuleID, &h.Type, &h.Enabled, &cfg, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, err
		}
		h.ConfigJSON = json.RawMessage(cfg)
		if h.RecipientGroupIDs, err = s.eventHandlerRecipientGroupIDs(ctx, h.ID); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func emailRecipientGroupIDs(handlers []cloudhub.AlertRuleEventHandler) []string {
	for _, h := range handlers {
		if h.Type == cloudhub.AlertRuleEventHandlerEmail && h.Enabled {
			return append([]string(nil), h.RecipientGroupIDs...)
		}
	}
	return nil
}

func (s *AlertRuleStore) RecipientGroupsByEventHandler(ctx context.Context, handlerID string) ([]cloudhub.RecipientGroup, error) {
	ids, err := s.eventHandlerRecipientGroupIDs(ctx, handlerID)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, nil
	}
	rgStore := NewRecipientGroupStore(s.client)
	out := make([]cloudhub.RecipientGroup, 0, len(ids))
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
	const q = `
		WITH target_group AS (
			SELECT org_id FROM recipient_groups WHERE id = $1 AND delete_yn = false
		)
		SELECT DISTINCT h.alert_rule_id
		FROM alert_rule_event_handlers h
		JOIN alert_rules r ON r.id = h.alert_rule_id AND r.delete_yn = false
		JOIN target_group tg ON tg.org_id = r.org_id
		WHERE h.delete_yn = false
		  AND h.enabled = true
		  AND (
			EXISTS (
				SELECT 1
				FROM alert_rule_event_handler_recipient_groups g
				WHERE g.alert_rule_event_handler_id = h.id
				  AND g.recipient_group_id = $1
			)
			OR NOT EXISTS (
				SELECT 1
				FROM alert_rule_event_handler_recipient_groups g
				WHERE g.alert_rule_event_handler_id = h.id
			)
		  )`
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
