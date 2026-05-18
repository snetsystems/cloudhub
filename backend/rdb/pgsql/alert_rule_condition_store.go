package pgsql

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

var _ cloudhub.AlertRuleConditionStore = (*AlertRuleConditionStore)(nil)

type AlertRuleConditionStore struct{ client *Client }

func NewAlertRuleConditionStore(client *Client) *AlertRuleConditionStore {
	return &AlertRuleConditionStore{client: client}
}

func (s *AlertRuleConditionStore) ByRule(ctx context.Context, ruleID string) ([]cloudhub.AlertRuleCondition, error) {
	const q = `SELECT alert_rule_id, level, value, enabled FROM alert_rule_conditions WHERE alert_rule_id = $1 ORDER BY level`
	rows, err := s.client.QueryContext(ctx, q, ruleID)
	if err != nil {
		return nil, fmt.Errorf("alert_rule_conditions.ByRule: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.AlertRuleCondition
	for rows.Next() {
		var c cloudhub.AlertRuleCondition
		if err := rows.Scan(&c.AlertRuleID, &c.Level, &c.Value, &c.Enabled); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *AlertRuleConditionStore) SetForRule(ctx context.Context, ruleID string, conditions []cloudhub.AlertRuleCondition) error {
	return s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM alert_rule_conditions WHERE alert_rule_id = $1`, ruleID); err != nil {
			return err
		}
		for _, c := range conditions {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO alert_rule_conditions (alert_rule_id, level, value, enabled) VALUES ($1,$2,$3,$4)`,
				ruleID, c.Level, c.Value, c.Enabled,
			); err != nil {
				return err
			}
		}
		return nil
	})
}
