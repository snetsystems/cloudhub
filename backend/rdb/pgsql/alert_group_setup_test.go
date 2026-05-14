package pgsql_test

import (
	"context"
	"testing"

	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

// setupAlertGroupTestDB initializes a fresh test DB and registers a cleanup
// that truncates every alert-group-related table so each test starts clean.
func setupAlertGroupTestDB(t *testing.T) (*pgsql.Client, func()) {
	t.Helper()
	client, cleanup0 := setupTestDB(t)
	cleanup := func() {
		ctx := context.Background()
		_, _ = client.ExecContext(ctx, "TRUNCATE TABLE alert_kapacitor_mappings, alert_kapacitors, alert_rule_hosts, alert_rule_user_groups, alert_rule_time_tags, alert_rules, user_groups, alert_time_tags, alert_suppression_settings RESTART IDENTITY CASCADE")
		cleanup0()
	}
	return client, cleanup
}
