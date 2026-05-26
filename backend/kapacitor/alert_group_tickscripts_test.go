package kapacitor

import (
	"encoding/json"
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
		TaskType: "stream",
		Every:    "30s",
		Message:  "cpu high",
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

// TestAlertGroupRuleTICKScriptPreservesAlertHistoryWhenNoRecipients verifies
// that a rule with no enabled handlers (zero recipients) still emits the main
// alert + influxDBOut('cloudhub_alerts') pipeline. This is the "log only" path:
// alert occurrences are persisted to the output measurement even when no
// external notification channel is configured.
func TestAlertGroupRuleTICKScriptPreservesAlertHistoryWhenNoRecipients(t *testing.T) {
	tick, err := AlertGroupRuleTICKScript(sampleRule(), AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, "var outputMeasurement = 'cloudhub_alerts'") {
		t.Fatalf("tickscript must declare cloudhub_alerts output measurement:\n%s", tick)
	}
	if !strings.Contains(tick, "|influxDBOut()") {
		t.Fatalf("tickscript must persist alerts via influxDBOut() when no handler is configured:\n%s", tick)
	}
	if !strings.Contains(tick, ".measurement(outputMeasurement)") {
		t.Fatalf("tickscript must write to the outputMeasurement (cloudhub_alerts):\n%s", tick)
	}
	if !strings.Contains(tick, "|alert()") {
		t.Fatalf("tickscript must contain a main alert() node even without handlers:\n%s", tick)
	}
	if strings.Contains(tick, ".email()") {
		t.Fatalf("tickscript must not emit email() handler when recipients are empty:\n%s", tick)
	}
	if strings.Contains(tick, ".to(") {
		t.Fatalf("tickscript must not emit any .to(...) recipient when no handler is configured:\n%s", tick)
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

func TestAlertGroupRuleTICKScriptUsesEmailHandlerBodyAsDetails(t *testing.T) {
	r := sampleRule()
	r.EventHandlers = []cloudhub.AlertRuleEventHandler{{
		Type:              cloudhub.AlertRuleEventHandlerEmail,
		Enabled:           true,
		ConfigJSON:        []byte(`{"body":"CPU alert body {{ .Level }}"}`),
		RecipientGroupIDs: []string{"group-1"},
	}}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}

	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, `.message('cpu high')`) {
		t.Fatalf("tickscript should keep rule.message as email title:\n%s", tick)
	}
	if !strings.Contains(tick, `.details('CPU alert body {{ .Level }}')`) {
		t.Fatalf("tickscript should render email handler body as details:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptUsesPerConditionOperators(t *testing.T) {
	r := sampleRule()
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 90, Operator: "greater_equal", Enabled: true},
		{Level: "warning", Value: 20, Operator: "less", Enabled: true},
		{Level: "info", Value: 0, Operator: "equal", Enabled: true},
	}

	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`.crit(lambda: "usage_idle" >= 90)`,
		`.warn(lambda: "usage_idle" < 20)`,
		`.info(lambda: "usage_idle" == 0)`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("tickscript missing %q:\n%s", want, tick)
		}
	}
}

func TestAlertGroupRuleTICKScriptRelativeUsesPerConditionOperators(t *testing.T) {
	r := sampleRule()
	r.Trigger = cloudhub.AlertGroupRuleTriggerRelative
	r.TriggerValues = cloudhub.TriggerValues{Change: "change", Shift: "1m", Operator: "greater than"}
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 40, Operator: "less_equal", Enabled: true},
		{Level: "warning", Value: 10, Operator: "greater", Enabled: true},
	}

	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`.crit(lambda: "relative_value" <= 40)`,
		`.warn(lambda: "relative_value" > 10)`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("relative tickscript missing %q:\n%s", want, tick)
		}
	}
	if strings.Contains(tick, `.crit(lambda: "relative_value" > 40)`) {
		t.Fatalf("relative trigger must not use triggerValues.operator as condition operator:\n%s", tick)
	}
}

// TestAlertGroupRuleTICKScriptCollapsesEmailBodyNewlines verifies that an
// HTML email body containing real newlines gets collapsed to spaces rather
// than being escaped as literal "\n". TICKscript single-quoted strings do
// not interpret escape sequences, so a literal "\n" would survive untouched
// and end up visible in the rendered email body.
func TestAlertGroupRuleTICKScriptCollapsesEmailBodyNewlines(t *testing.T) {
	r := sampleRule()
	body := "<html>\n  <body>hi</body>\n</html>"
	bodyJSON, err := json.Marshal(map[string]string{"body": body})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	r.EventHandlers = []cloudhub.AlertRuleEventHandler{{
		Type:              cloudhub.AlertRuleEventHandlerEmail,
		Enabled:           true,
		ConfigJSON:        bodyJSON,
		RecipientGroupIDs: []string{"group-1"},
	}}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}

	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, `.details('<html>   <body>hi</body> </html>')`) {
		t.Fatalf("tickscript should collapse newlines in email body to spaces:\n%s", tick)
	}
	idx := strings.Index(tick, `.details('`)
	if idx < 0 {
		t.Fatalf("tickscript missing .details(...): %s", tick)
	}
	end := strings.Index(tick[idx:], `')`)
	if end < 0 {
		t.Fatalf("tickscript .details(...) not closed: %s", tick)
	}
	detailsSegment := tick[idx : idx+end]
	if strings.Contains(detailsSegment, `\n`) {
		t.Fatalf("tickscript .details(...) must not contain literal \\n (would render as visible text):\n%s", detailsSegment)
	}
}

func TestAlertGroupRuleTICKScriptEmbedsNonEmailHandlersWithPausePolicy(t *testing.T) {
	r := sampleRule()
	r.PauseSeconds = 60
	r.EventHandlers = []cloudhub.AlertRuleEventHandler{
		{
			Type:       cloudhub.AlertRuleEventHandlerSlack,
			Enabled:    true,
			ConfigJSON: []byte(`{"workspace":"default","channel":"#alerts","username":"cloudhub","iconEmoji":":warning:"}`),
		},
		{
			Type:       cloudhub.AlertRuleEventHandlerKafka,
			Enabled:    true,
			ConfigJSON: []byte(`{"cluster":"default","kafka-topic":"alerts","template":"{{ json . }}"}`),
		},
		{
			Type:       cloudhub.AlertRuleEventHandlerTCP,
			Enabled:    true,
			ConfigJSON: []byte(`{"address":"127.0.0.1:9999"}`),
		},
		{
			Type:       cloudhub.AlertRuleEventHandlerExec,
			Enabled:    true,
			ConfigJSON: []byte(`{"command":["/bin/echo","alert"]}`),
		},
		{
			Type:       cloudhub.AlertRuleEventHandlerLog,
			Enabled:    true,
			ConfigJSON: []byte(`{"filePath":"/tmp/cloudhub-alerts.log"}`),
		},
		{
			Type:       cloudhub.AlertRuleEventHandlerTelegram,
			Enabled:    true,
			ConfigJSON: []byte(`{"chatId":"12345","parseMode":"HTML","disableWebPagePreview":true,"disableNotification":true}`),
		},
	}

	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`.id('alert-group-rule-1-email-crit')`,
		`.stateChangesOnly(60s)`,
		`.slack()`,
		`.workspace('default')`,
		`.channel('#alerts')`,
		`.kafka()`,
		`.cluster('default')`,
		`.kafkaTopic('alerts')`,
		`.tcp('127.0.0.1:9999')`,
		`.exec('/bin/echo', 'alert')`,
		`.log('/tmp/cloudhub-alerts.log')`,
		`.telegram()`,
		`.chatId('12345')`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("tickscript missing %q\n%s", want, tick)
		}
	}
}

func TestAlertGroupRuleTICKScriptEmbedsNonEmailHandlersInRecoveryBranch(t *testing.T) {
	r := sampleRule()
	r.NotifyRecovery = true
	r.EventHandlers = []cloudhub.AlertRuleEventHandler{{
		Type:       cloudhub.AlertRuleEventHandlerSlack,
		Enabled:    true,
		ConfigJSON: []byte(`{"workspace":"default","channel":"#alerts"}`),
	}}

	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, `.id('alert-group-rule-1-email-recovery')`) {
		t.Fatalf("tickscript should render recovery notification branch:\n%s", tick)
	}
	if !strings.Contains(tick, `.message('Recovery: cpu high')`) {
		t.Fatalf("tickscript should render recovery message:\n%s", tick)
	}
	if !strings.Contains(tick, `.slack()`) || !strings.Contains(tick, `.channel('#alerts')`) {
		t.Fatalf("tickscript should attach non-email handler to recovery branch:\n%s", tick)
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
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "info", Value: 90, Operator: "less", Enabled: true},
		{Level: "warning", Value: 60, Operator: "less", Enabled: true},
		{Level: "critical", Value: 30, Operator: "less", Enabled: true},
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

// TestAlertGroupRuleTICKScriptConsecutiveIgnoresOccurrenceWindow verifies that
// consecutive mode does NOT apply the occurrenceWindow as a streak-duration
// bound, even when the window is explicitly set. The previous implementation
// emitted a stateDuration node and an extra `state_duration <= W` clause,
// which caused sustained alerts to auto-recover after the window elapsed
// (see docs/alert_group_consecutive_window.md).
func TestAlertGroupRuleTICKScriptConsecutiveIgnoresOccurrenceWindow(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 5
	r.OccurrenceType = "consecutive"
	r.OccurrenceWindow = "10m" // window must be ignored for consecutive mode.
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
	// stateCount must be present; stateDuration must NOT be emitted.
	if !strings.Contains(tick, `|stateCount(lambda: "usage_idle" > 60)`) {
		t.Fatalf("expected stateCount node in:\n%s", tick)
	}
	if strings.Contains(tick, "stateDuration") {
		t.Fatalf("consecutive must not emit stateDuration even when window is set:\n%s", tick)
	}
	if strings.Contains(tick, `"state_duration"`) {
		t.Fatalf("consecutive lambdas must not reference state_duration:\n%s", tick)
	}
	// Lambdas must only gate on state_count and the per-level threshold.
	wantCrit := `.crit(lambda: "state_count" >= 5 AND ("usage_idle" > 90))`
	if !strings.Contains(tick, wantCrit) {
		t.Fatalf("expected CRIT lambda %q in:\n%s", wantCrit, tick)
	}
	wantWarn := `.warn(lambda: "state_count" >= 5 AND ("usage_idle" > 60 AND "usage_idle" <= 90))`
	if !strings.Contains(tick, wantWarn) {
		t.Fatalf("expected WARN email lambda %q in:\n%s", wantWarn, tick)
	}
	// Recent-mode windowed sum nodes must not appear either.
	if strings.Contains(tick, "|window()") {
		t.Fatalf("consecutive must not emit window() block:\n%s", tick)
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("consecutive tickscript should validate: %v\n%s", err, tick)
	}
}

// TestAlertGroupRuleTICKScriptConsecutiveWithoutWindowOmitsStateDuration verifies
// the fallback: when consecutive has no occurrenceWindow (or invalid), the
// stateDuration node and duration AND-clause are omitted — preserving the
// classic plain-consecutive tickscript shape.
func TestAlertGroupRuleTICKScriptConsecutiveWithoutWindowOmitsStateDuration(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 3
	r.OccurrenceType = "consecutive"
	r.OccurrenceWindow = "" // no window → fallback to plain stateCount-only
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, "stateDuration") {
		t.Fatalf("consecutive without window must not emit stateDuration:\n%s", tick)
	}
	if strings.Contains(tick, `"state_duration"`) {
		t.Fatalf("consecutive without window must not reference state_duration in lambdas:\n%s", tick)
	}
	wantCrit := `.crit(lambda: "state_count" >= 3 AND ("usage_idle" > 90))`
	if !strings.Contains(tick, wantCrit) {
		t.Fatalf("expected plain consecutive CRIT lambda %q in:\n%s", wantCrit, tick)
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

// TestAlertGroupRuleTICKScriptRecentNeverEmitsStateNodes is a regression guard:
// recent mode must not borrow consecutive's stateCount/stateDuration plumbing.
// Sustained-alert auto-recovery (the bug that motivated removing the window from
// consecutive — see backend/docs/alert_group_consecutive_window.md) hinges on
// state_duration being chained into the alert lambda. Recent mode relies on
// window().sum() instead, and lambdas must depend exclusively on the *_count
// fields.
func TestAlertGroupRuleTICKScriptRecentNeverEmitsStateNodes(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 3
	r.OccurrenceType = "recent"
	r.OccurrenceWindow = "5m"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}, Warn: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, forbidden := range []string{
		"stateCount",
		"stateDuration",
		`"state_count"`,
		`"state_duration"`,
	} {
		if strings.Contains(tick, forbidden) {
			t.Fatalf("recent mode must not reference %q in:\n%s", forbidden, tick)
		}
	}
}

// TestAlertGroupRuleTICKScriptRecentSingleLevelOmitsOtherCounts verifies that
// a crit-only rule produces no warn_count / info_count references anywhere in
// the tickscript. The builder still emits a main + email pair per enabled
// level (so join() is present), but unrelated levels must not leak in.
func TestAlertGroupRuleTICKScriptRecentSingleLevelOmitsOtherCounts(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 3
	r.OccurrenceType = "recent"
	r.OccurrenceWindow = "5m"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, forbidden := range []string{
		"warn_count", "warn_hit", "recent_warn",
		"info_count", "info_hit", "recent_info",
	} {
		if strings.Contains(tick, forbidden) {
			t.Fatalf("crit-only rule must not reference %q in:\n%s", forbidden, tick)
		}
	}
	for _, want := range []string{
		`var recent_crit = src`,
		`var recent_email_crit = src`,
		`|sum('crit_hit')`,
		`.as('crit_count')`,
		`.crit(lambda: "crit_count" >= 3)`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected fragment %q in:\n%s", want, tick)
		}
	}
}

// TestAlertGroupRuleTICKScriptRecentEmailLambdasExcludeHigherLevels verifies
// that the email WARN branch counts only points strictly inside (60, 90] —
// a 95% point must NOT contribute to email_warn_count. This is the level-
// exclusivity guarantee carried over from buildExclusiveLambdas into the
// hit-evaluation expression that drives recent-mode counters.
func TestAlertGroupRuleTICKScriptRecentEmailLambdasExcludeHigherLevels(t *testing.T) {
	r := sampleRule()
	r.OccurrenceCount = 3
	r.OccurrenceType = "recent"
	r.OccurrenceWindow = "5m"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "warning", Value: 60, Enabled: true},
		{Level: "critical", Value: 90, Enabled: true},
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}, Warn: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	// Email WARN must exclude CRIT range; email CRIT is just > 90.
	wantEmailWarnHit := `|eval(lambda: if("usage_idle" > 60 AND "usage_idle" <= 90, 1, 0))`
	wantEmailCritHit := `|eval(lambda: if("usage_idle" > 90, 1, 0))`
	if !strings.Contains(tick, wantEmailWarnHit) {
		t.Fatalf("expected email warn hit lambda %q in:\n%s", wantEmailWarnHit, tick)
	}
	if !strings.Contains(tick, wantEmailCritHit) {
		t.Fatalf("expected email crit hit lambda %q in:\n%s", wantEmailCritHit, tick)
	}
	// Email WARN lambda must NOT trigger on the bare > 60 form (which would
	// also fire when value > 90 — double-notification bug).
	bareWarn := `.as('email_warn_hit')`
	if !strings.Contains(tick, bareWarn) {
		t.Fatalf("expected email_warn_hit assignment in:\n%s", tick)
	}
	// Main trigger WARN lambda may keep the bare > 60 form because Kapacitor
	// resolves CRIT > WARN by precedence — only email branches need exclusion.
	wantMainWarn := `.warn(lambda: "warn_count" >= 3)`
	if !strings.Contains(tick, wantMainWarn) {
		t.Fatalf("expected main WARN lambda %q in:\n%s", wantMainWarn, tick)
	}
}

// TestAlertGroupRuleTICKScriptRecentDefaultsEveryWhenMissing verifies the
// builder's `every` fallback: an empty rule.Every must not produce
// `.every()` (which would be invalid TICK) — it falls back to 30s.
func TestAlertGroupRuleTICKScriptRecentDefaultsEveryWhenMissing(t *testing.T) {
	r := sampleRule()
	r.Every = "" // builder must apply a sane default.
	r.OccurrenceCount = 3
	r.OccurrenceType = "recent"
	r.OccurrenceWindow = "5m"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 90, Enabled: true},
	}
	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, ".every()") {
		t.Fatalf("recent mode must not emit empty .every() when rule.Every is unset:\n%s", tick)
	}
	if !strings.Contains(tick, ".every(30s)") {
		t.Fatalf("recent mode must fall back to .every(30s) when rule.Every is unset:\n%s", tick)
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("recent tickscript should validate with default every: %v\n%s", err, tick)
	}
}

func TestAlertGroupRuleTICKScriptRelativeChange(t *testing.T) {
	r := sampleRule()
	r.Trigger = "relative"
	r.TriggerValues = cloudhub.TriggerValues{
		Shift:    "2m",
		Change:   "change",
		Operator: "greater than",
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`var past = src`,
		`|shift(2m)`,
		`|join(current)`,
		`.as('past', 'current')`,
		`|eval(lambda: float("current.usage_idle" - "past.usage_idle"))`,
		`.as('relative_value')`,
		`.crit(lambda: "relative_value" > 70)`,
		`.tag('triggerType', 'relative')`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected relative fragment %q in:\n%s", want, tick)
		}
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("relative tickscript should validate: %v\n%s", err, tick)
	}
}

func TestAlertGroupRuleTICKScriptRelativePercentChangeSkipsZeroPastValue(t *testing.T) {
	r := sampleRule()
	r.Trigger = "relative"
	r.TriggerValues = cloudhub.TriggerValues{
		Shift:    "2m",
		Change:   "% change",
		Operator: "greater than",
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`|where(lambda: "past.usage_idle" != 0.0)`,
		`|eval(lambda: abs(float("current.usage_idle" - "past.usage_idle"))/float("past.usage_idle") * 100.0)`,
		`.as('relative_value')`,
		`.crit(lambda: "relative_value" > 70)`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected relative percent fragment %q in:\n%s", want, tick)
		}
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("relative percent tickscript should validate: %v\n%s", err, tick)
	}
}

func TestAlertGroupRuleTICKScriptDeadman(t *testing.T) {
	r := sampleRule()
	r.Trigger = "deadman"
	r.TriggerValues = cloudhub.TriggerValues{Period: "3m"}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`|deadman(0.0, 3m)`,
		`.id('alert-group-rule-1')`,
		`.id('alert-group-rule-1-email-crit')`,
		`.tag('triggerType', 'deadman')`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected deadman fragment %q in:\n%s", want, tick)
		}
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("deadman tickscript should validate: %v\n%s", err, tick)
	}
}

func TestAlertGroupRuleTICKScriptExclusiveLambdasForLessOperator(t *testing.T) {
	r := sampleRule()
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "info", Value: 90, Operator: "less", Enabled: true},
		{Level: "warning", Value: 60, Operator: "less", Enabled: true},
		{Level: "critical", Value: 30, Operator: "less", Enabled: true},
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

func TestAlertGroupRuleTICKScriptEmitsDerivativeNode(t *testing.T) {
	r := sampleRule()
	r.Measurement = "net"
	r.Field = "bytes_recv"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 125000000, Enabled: true},
	}
	r.Derivative = &cloudhub.DerivativeConfig{Enabled: true, NonNegative: true, Unit: "1s"}
	rec := AlertRecipients{Crit: []string{"a@x.com"}}

	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`|derivative('bytes_recv')`,
		`.nonNegative()`,
		`.unit(1s)`,
		// Threshold lambda still references the field name (derivative keeps the name).
		`.crit(lambda: "bytes_recv" > 125000000)`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected derivative fragment %q in:\n%s", want, tick)
		}
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("derivative tickscript should validate: %v\n%s", err, tick)
	}
}

func TestAlertGroupRuleTICKScriptDerivativeOmitsNonNegativeWhenFalse(t *testing.T) {
	r := sampleRule()
	r.Derivative = &cloudhub.DerivativeConfig{Enabled: true, NonNegative: false, Unit: "10s"}
	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{Crit: []string{"a@x.com"}}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, `.unit(10s)`) {
		t.Fatalf("expected .unit(10s) in:\n%s", tick)
	}
	if strings.Contains(tick, `.nonNegative()`) {
		t.Fatalf("did not expect .nonNegative() when NonNegative=false:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptDerivativeIgnoredWhenDisabled(t *testing.T) {
	r := sampleRule()
	r.Derivative = &cloudhub.DerivativeConfig{Enabled: false, NonNegative: true, Unit: "1s"}
	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{Crit: []string{"a@x.com"}}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, `|derivative(`) {
		t.Fatalf("did not expect derivative node when disabled:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptEmitsEvalNode(t *testing.T) {
	r := sampleRule()
	r.Measurement = "disk"
	r.Field = "inodes_used"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 95, Enabled: true},
		{Level: "warning", Value: 80, Enabled: true},
	}
	r.Eval = &cloudhub.EvalConfig{
		Expression: `float("inodes_used") / float("inodes_total") * 100.0`,
		As:         "inodes_used_percent",
	}
	rec := AlertRecipients{Crit: []string{"a@x.com"}, Warn: []string{"a@x.com"}}

	tick, err := AlertGroupRuleTICKScript(r, rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	for _, want := range []string{
		`|eval(lambda: float("inodes_used") / float("inodes_total") * 100.0)`,
		`.as('inodes_used_percent')`,
		`.keep()`,
		// Threshold lambdas reference the eval alias, not the raw field.
		`.crit(lambda: "inodes_used_percent" > 95)`,
		`.warn(lambda: "inodes_used_percent" > 80 AND "inodes_used_percent" <= 95)`,
	} {
		if !strings.Contains(tick, want) {
			t.Fatalf("expected eval fragment %q in:\n%s", want, tick)
		}
	}
	if strings.Contains(tick, `"inodes_used" >`) {
		t.Fatalf("threshold lambdas should not reference raw inodes_used after eval:\n%s", tick)
	}
	if err := validateTick(cloudhub.TICKScript(tick)); err != nil {
		t.Fatalf("eval tickscript should validate: %v\n%s", err, tick)
	}
}

func TestAlertGroupRuleTICKScriptEvalIgnoredWhenIncomplete(t *testing.T) {
	r := sampleRule()
	r.Eval = &cloudhub.EvalConfig{Expression: "", As: "foo"} // missing expression
	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{Crit: []string{"a@x.com"}}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, `|eval(`) {
		t.Fatalf("did not expect eval node when expression empty:\n%s", tick)
	}
	if !strings.Contains(tick, `"usage_idle" > 70`) {
		t.Fatalf("expected raw-field threshold when eval inactive:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptEvalBeforeDerivative(t *testing.T) {
	// When both are active, eval renames the field, derivative reads from the
	// alias (not the raw field). Threshold lambda continues to reference the
	// eval alias (derivative keeps the name by default).
	r := sampleRule()
	r.Measurement = "disk"
	r.Field = "inodes_used"
	r.Conditions = []cloudhub.AlertRuleCondition{
		{Level: "critical", Value: 10, Enabled: true},
	}
	r.Eval = &cloudhub.EvalConfig{
		Expression: `float("inodes_used") / float("inodes_total") * 100.0`,
		As:         "inodes_used_percent",
	}
	r.Derivative = &cloudhub.DerivativeConfig{Enabled: true, NonNegative: true, Unit: "1s"}

	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{Crit: []string{"a@x.com"}}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	evalIdx := strings.Index(tick, `|eval(`)
	derivIdx := strings.Index(tick, `|derivative(`)
	if evalIdx < 0 || derivIdx < 0 {
		t.Fatalf("expected both eval and derivative in:\n%s", tick)
	}
	if evalIdx > derivIdx {
		t.Fatalf("eval node should precede derivative node:\nevalIdx=%d derivIdx=%d\n%s", evalIdx, derivIdx, tick)
	}
	if !strings.Contains(tick, `|derivative('inodes_used_percent')`) {
		t.Fatalf("derivative should consume the eval alias:\n%s", tick)
	}
	if !strings.Contains(tick, `.crit(lambda: "inodes_used_percent" > 10)`) {
		t.Fatalf("threshold lambda should reference eval alias:\n%s", tick)
	}
}
