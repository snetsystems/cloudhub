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
		_, _ = client.ExecContext(ctx, `TRUNCATE TABLE
			alert_rule_recipient_groups,
			alert_rule_hosts,
			alert_rule_trigger_values,
			alert_rule_conditions,
			alert_rules,
			alert_kapacitor_mappings,
			alert_kapacitors,
			alert_recipient_member_prefs,
			alert_recipient_groups,
			recipient_group_members,
			recipient_groups
		RESTART IDENTITY CASCADE`)
		cleanup0()
	}
	return client, cleanup
}
