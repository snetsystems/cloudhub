package kapacitor

import (
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func sampleRule() cloudhub.AlertGroupRule {
	return cloudhub.AlertGroupRule{
		ID:              "rule-1",
		Name:            "cpu high",
		Database:        "Default",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertRuleCondition{
			{Level: "critical", Value: 70, Enabled: true},
		},
		TriggerOperator: "greater",
		TaskType:        "stream",
		Every:           "30s",
		Message:         "cpu high",
	}
}

func TestAlertGroupRuleTICKScriptDropsAlertUdf(t *testing.T) {
	tick, err := AlertGroupRuleTICKScript(sampleRule(), AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, "@alertUdf") {
		t.Fatalf("tickscript must not reference @alertUdf:\n%s", tick)
	}
	if strings.Contains(tick, "groupFilter") {
		t.Fatalf("tickscript must not reference groupFilter mode:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOmitsHostFilterWhenNoHosts(t *testing.T) {
	tick, err := AlertGroupRuleTICKScript(sampleRule(), AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, `"host" ==`) {
		t.Fatalf("tickscript must not emit host filter when hostnames empty:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptInlinesStreamHostFilter(t *testing.T) {
	tick, err := AlertGroupRuleTICKScript(sampleRule(), AlertRecipients{}, []string{"host-a", "host-b"})
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	want := `.where(lambda: "host" == 'host-a' OR "host" == 'host-b')`
	if !strings.Contains(tick, want) {
		t.Fatalf("tickscript must inline stream host filter %q in:\n%s", want, tick)
	}
}

func TestAlertGroupRuleTICKScriptInlinesBatchHostFilter(t *testing.T) {
	r := sampleRule()
	r.TaskType = "batch"
	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{}, []string{"host-a"})
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	want := `WHERE time > -30s AND ("host" = 'host-a')`
	if !strings.Contains(tick, want) {
		t.Fatalf("tickscript must inline batch host filter %q in:\n%s", want, tick)
	}
}

func TestAlertGroupRuleTICKScriptEmbedsCriticalRecipients(t *testing.T) {
	rec := AlertRecipients{Crit: []string{"a@x.com", "b@x.com"}}
	tick, err := AlertGroupRuleTICKScript(sampleRule(), rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, "email-crit") {
		t.Fatalf("tickscript should add an email-crit alert node:\n%s", tick)
	}
	if !strings.Contains(tick, ".email()") {
		t.Fatalf("tickscript should use email() handler:\n%s", tick)
	}
	if !strings.Contains(tick, ".to('a@x.com')") || !strings.Contains(tick, ".to('b@x.com')") {
		t.Fatalf("tickscript should embed both critical recipients:\n%s", tick)
	}
	// Email branch evaluates the real threshold lambda (no chain via where(level==CRITICAL))
	// so stateChangesOnly(<pause>) reminders can tick on every input.
	if !strings.Contains(tick, `.crit(lambda: "usage_idle" > 70)`) {
		t.Fatalf("email branch should evaluate the threshold directly:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOmitsLevelBranchWhenEmpty(t *testing.T) {
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(sampleRule(), rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, "\"level\" == 'WARNING'") {
		t.Fatalf("tickscript should omit WARNING branch when warn list is empty:\n%s", tick)
	}
	if strings.Contains(tick, "\"level\" == 'INFO'") {
		t.Fatalf("tickscript should omit INFO branch when info list is empty:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptEmbedsPauseReminder(t *testing.T) {
	r := sampleRule()
	r.PauseSeconds = 30
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, ".stateChangesOnly(30s)") {
		t.Fatalf("tickscript should render reminder cadence stateChangesOnly(30s):\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOmitsPauseArgWhenZero(t *testing.T) {
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(sampleRule(), rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, ".stateChangesOnly()") {
		t.Fatalf("tickscript should render no-arg stateChangesOnly() when pause_seconds=0:\n%s", tick)
	}
	if strings.Contains(tick, ".stateChangesOnly(0s)") {
		t.Fatalf("tickscript should NOT render stateChangesOnly(0s):\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptWrapsWithStateCountForConsecutive(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 3
	r.OccurrenceType = "consecutive"
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, `|stateCount(lambda: "usage_idle" > 70)`) {
		t.Fatalf("tickscript should add stateCount wrap for the most permissive threshold:\n%s", tick)
	}
	if !strings.Contains(tick, `.crit(lambda: "state_count" >= 3 AND ("usage_idle" > 70))`) {
		t.Fatalf("tickscript crit lambda should require state_count >= 3:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOccurrenceLambdaPicksLowestForGreater(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 2
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "info", Value: 30, Enabled: true},
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	// For 'greater' operator, the most permissive threshold is the LOWEST (30).
	if !strings.Contains(tick, `|stateCount(lambda: "usage_idle" > 30)`) {
		t.Fatalf("expected stateCount with lowest threshold (30) for greater op:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOccurrenceLambdaPicksHighestForLess(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 2
	r.TriggerOperator = "less"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "info", Value: 90, Enabled: true},
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 30, Enabled: true},
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	// For 'less' operator, the most permissive threshold is the HIGHEST (90).
	if !strings.Contains(tick, `|stateCount(lambda: "usage_idle" < 90)`) {
		t.Fatalf("expected stateCount with highest threshold (90) for less op:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOccurrenceIgnoredWhenCountLE1(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 1
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, "|stateCount(") {
		t.Fatalf("tickscript should NOT wrap with stateCount when OccurrenceCount=1:\n%s", tick)
	}
	if strings.Contains(tick, `"state_count"`) {
		t.Fatalf("tickscript should NOT reference state_count when OccurrenceCount=1:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptEmitsRecoveryBranchWhenNotifyRecovery(t *testing.T) {
	r := sampleRule()
	r.NotifyRecovery = true
	rec := AlertRecipients{
		Crit: []string{"crit@x.com"},
		Warn: []string{"warn@x.com"},
		Info: []string{"info@x.com", "crit@x.com"}, // duplicate to verify dedup
	}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, "|where(lambda: \"level\" == 'OK')") {
		t.Fatalf("tickscript should add recovery branch on OK level when NotifyRecovery=true:\n%s", tick)
	}
	if !strings.Contains(tick, "alert-group-rule-1-email-recovery") {
		t.Fatalf("recovery branch should use -email-recovery id suffix:\n%s", tick)
	}
	if !strings.Contains(tick, "Recovery: cpu high") {
		t.Fatalf("recovery branch should prepend 'Recovery: ' to message:\n%s", tick)
	}
	// All three recipients should appear in recovery .to() — dedup'd to 3 unique entries.
	for _, addr := range []string{"crit@x.com", "warn@x.com", "info@x.com"} {
		if strings.Count(tick, ".to('"+addr+"')") < 1 {
			t.Fatalf("recovery branch missing recipient %s:\n%s", addr, tick)
		}
	}
}

func TestAlertGroupRuleTICKScriptOmitsRecoveryBranchByDefault(t *testing.T) {
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(sampleRule(), rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, "\"level\" == 'OK'") {
		t.Fatalf("tickscript should omit recovery branch when NotifyRecovery=false:\n%s", tick)
	}
	if strings.Contains(tick, "email-recovery") {
		t.Fatalf("tickscript should omit recovery branch when NotifyRecovery=false:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptMultiLevelEmailExclusivity(t *testing.T) {
	r := sampleRule()
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "info", Value: 30, Enabled: true},
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{
		Crit: []string{"all@x.com"},
		Warn: []string{"all@x.com"},
		Info: []string{"all@x.com"},
	}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}

	// CRIT email branch: no exclusion needed (no higher level).
	wantCrit := `.crit(lambda: "usage_idle" > 90)`
	if !strings.Contains(tick, wantCrit) {
		t.Fatalf("expected CRIT email branch lambda %q in:\n%s", wantCrit, tick)
	}
	// WARN email branch: range expression — warn > 60 AND <= 90 (inverse of crit).
	wantWarn := `.warn(lambda: "usage_idle" > 60 AND "usage_idle" <= 90)`
	if !strings.Contains(tick, wantWarn) {
		t.Fatalf("expected WARN email branch lambda %q in:\n%s", wantWarn, tick)
	}
	// INFO email branch: range expression excluding both higher levels.
	wantInfo := `.info(lambda: "usage_idle" > 30 AND "usage_idle" <= 60 AND "usage_idle" <= 90)`
	if !strings.Contains(tick, wantInfo) {
		t.Fatalf("expected INFO email branch lambda %q in:\n%s", wantInfo, tick)
	}

	// Main trigger keeps non-exclusive lambdas (Kapacitor's built-in level priority
	// resolves the levelTag to the highest matching condition).
	mainCrit := `.crit(lambda: "usage_idle" > 90)`
	mainWarn := `.warn(lambda: "usage_idle" > 60)`
	mainInfo := `.info(lambda: "usage_idle" > 30)`
	for _, want := range []string{mainCrit, mainWarn, mainInfo} {
		if !strings.Contains(tick, want) {
			t.Fatalf("main trigger missing non-exclusive lambda %q:\n%s", want, tick)
		}
	}
}

func TestAlertGroupRuleTICKScriptMultiLevelWithOccurrenceCount(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 3
	r.OccurrenceType = "consecutive"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{
		Crit: []string{"a@x.com"},
		Warn: []string{"a@x.com"},
	}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	// CRIT email branch: state_count + crit threshold.
	wantCrit := `.crit(lambda: "state_count" >= 3 AND ("usage_idle" > 90))`
	if !strings.Contains(tick, wantCrit) {
		t.Fatalf("expected CRIT email lambda %q in:\n%s", wantCrit, tick)
	}
	// WARN email branch: state_count + (warn range).
	wantWarn := `.warn(lambda: "state_count" >= 3 AND ("usage_idle" > 60 AND "usage_idle" <= 90))`
	if !strings.Contains(tick, wantWarn) {
		t.Fatalf("expected WARN email lambda %q in:\n%s", wantWarn, tick)
	}
}

func TestAlertGroupRuleTICKScriptRecentOccurrenceUsesWindowedCounts(t *testing.T) {
	r := sampleRule()
	r.Every = "30s"
	r.OccurrenceCount = 3
	r.OccurrenceType = "recent"
	r.OccurrenceWindow = "5m"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{
		Crit: []string{"a@x.com"},
		Warn: []string{"a@x.com"},
	}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`var recent_warn = src`,
		`|eval(lambda: if("usage_idle" > 60, 1, 0))`,
		`.as('warn_hit')`,
		`|window()`,
		`.period(5m)`,
		`.every(30s)`,
		`|sum('warn_hit')`,
		`.as('warn_count')`,
		`var recent_email_warn = src`,
		`|eval(lambda: if("usage_idle" > 60 AND "usage_idle" <= 90, 1, 0))`,
		`|join(recent_crit, recent_email_warn, recent_email_crit)`,
		`.as('warn', 'crit', 'email_warn', 'email_crit')`,
		`|eval(lambda: "warn.warn_count", lambda: "crit.crit_count", lambda: "email_warn.email_warn_count", lambda: "email_crit.email_crit_count")`,
		`.as('warn_count', 'crit_count', 'email_warn_count', 'email_crit_count')`,
		`.crit(lambda: "crit_count" >= 3)`,
		`.warn(lambda: "warn_count" >= 3)`,
		`.crit(lambda: "email_crit_count" >= 3)`,
		`.warn(lambda: "email_warn_count" >= 3)`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected recent occurrence fragment %q in:\n%s", want, tick)
		}
	}
	if strings.Contains(tick, `|stateCount(`) {
		t.Fatalf("recent occurrence should not use consecutive stateCount:\n%s", tick)
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("recent occurrence tickscript should validate: %v\n%s", err, tick)
	}
}

func TestAlertGroupRuleTICKScriptExclusiveLambdasForLessOperator(t *testing.T) {
	r := sampleRule()
	r.TriggerOperator = "less"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "info", Value: 90, Enabled: true},
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 30, Enabled: true},
	}
	rec := AlertRecipients{
		Crit: []string{"a@x.com"},
		Warn: []string{"a@x.com"},
		Info: []string{"a@x.com"},
	}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	// For less operator, the inverse is greater_equal: lower thresholds get >= anchor.
	wantCrit := `.crit(lambda: "usage_idle" < 30)`
	wantWarn := `.warn(lambda: "usage_idle" < 60 AND "usage_idle" >= 30)`
	wantInfo := `.info(lambda: "usage_idle" < 90 AND "usage_idle" >= 60 AND "usage_idle" >= 30)`
	for _, want := range []string{wantCrit, wantWarn, wantInfo} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected lambda %q in:\n%s", want, tick)
		}
	}
}
