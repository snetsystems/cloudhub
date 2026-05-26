package kapacitor

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"text/template"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	tmplstore "github.com/snetsystems/cloudhub/backend/templates"
)

var _ cloudhub.Ticker = &Alert{}

// Alert defines alerting strings in template rendering
type Alert struct {
}

// Generate creates a Tickscript from the alertrule
func (a *Alert) Generate(rule cloudhub.AlertRule) (cloudhub.TICKScript, error) {
	vars, err := Vars(rule)
	if err != nil {
		return "", err
	}
	data, err := Data(rule)
	if err != nil {
		return "", err
	}
	trigger, err := Trigger(rule)
	if err != nil {
		return "", err
	}
	services, err := AlertServices(rule)
	if err != nil {
		return "", err
	}
	output, err := InfluxOut(rule)
	if err != nil {
		return "", err
	}
	http, err := HTTPOut(rule)
	if err != nil {
		return "", err
	}

	raw := fmt.Sprintf("%s\n%s\n%s%s\n%s\n%s", vars, data, trigger, services, output, http)
	tick, err := formatTick(raw)
	if err != nil {
		return "", err
	}
	if err := validateTick(tick); err != nil {
		return tick, err
	}
	return tick, nil
}

// alertGroupTickParams holds the values injected into the alert_group_tick.toml template.
type alertGroupTickParams struct {
	Name                 string
	Measurement          string
	Field                string
	Every                string
	Info                 string // main-trigger lambda (Kapacitor picks highest matching level)
	Warn                 string
	Crit                 string
	EmailInfo            string // email-branch lambda, exclusive of higher levels
	EmailWarn            string
	EmailCrit            string
	PauseDuration        string // "" = no reminder; otherwise like "10s" — argument to stateChangesOnly()
	NotifyRecovery       bool   // true => emit a recovery email when level returns to OK
	TriggerType          string
	SourceVar            string
	RelativeEnabled      bool
	RelativeBlock        string
	DeadmanEnabled       bool
	DeadmanPeriod        string
	OccurrenceEnabled    bool   // true when OccurrenceCount > 1 (apply stateCount wrap)
	RecentEnabled        bool   // true when OccurrenceType asks for windowed recent counts
	OccurrenceCount      int    // N consecutive points required to trigger
	OccurrenceWindow     string // window duration for recent mode only
	OccurrenceLambda     string // stateCount lambda — typically the most permissive enabled threshold
	RecentBlock          string
	Message              string
	EmailBody            string
	NotificationHandlers string
	TaskID               string
	OutputDB             string
	OutputRP             string
	OutputMeasurement    string
	RecipientsInfo       []string
	RecipientsWarn       []string
	RecipientsCrit       []string
	RecipientsAll        []string // union (dedup'd, case-insensitive) of all level recipient lists — used for recovery email
	HostFilterLambda     string   // stream: `"host" == 'a' OR "host" == 'b'`; empty = all hosts
	HostFilterSQL        string   // batch:  ` AND ("host" = 'a' OR "host" = 'b')`; empty = all hosts
	// EvalEnabled inserts `|eval(lambda: <EvalExpression>).as('<EvalAs>').keep()`
	// after |from(). Stream-only. When active, threshold lambdas reference EvalAs
	// instead of the raw Field — see resolveLambdaField.
	EvalEnabled    bool
	EvalExpression string
	EvalAs         string
	// DerivativeEnabled inserts `|derivative('<DerivativeField>').[nonNegative()].unit(<DerivativeUnit>)`
	// after |eval() (or directly after |from() when Eval is inactive). Stream-only.
	// Result field name equals the input field — threshold lambdas unchanged.
	DerivativeEnabled     bool
	DerivativeField       string
	DerivativeNonNegative bool
	DerivativeUnit        string
}

// AlertGroupRuleTICKScript generates a TICKscript for an AlertGroupRule.
// Recipients are baked into the script via Kapacitor's native email() handler.
// Hostnames are inlined as a where() / SQL WHERE filter; an empty list means all hosts.
func AlertGroupRuleTICKScript(rule cloudhub.AlertGroupRule, recipients AlertRecipients, hostnames []string) (string, error) {
	if rule.ID == "" {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: rule ID required")
	}

	triggerType := strings.TrimSpace(strings.ToLower(rule.Trigger))
	if triggerType == "" {
		triggerType = cloudhub.AlertGroupRuleTriggerThreshold
	}
	sourceVar := "src"
	evalActive := rule.Eval != nil && strings.TrimSpace(rule.Eval.Expression) != "" && strings.TrimSpace(rule.Eval.As) != ""
	derivativeActive := rule.Derivative != nil && rule.Derivative.Enabled
	var info, warn, crit string
	for _, c := range rule.Conditions {
		if !c.Enabled {
			continue
		}
		field := resolveLambdaField(rule, triggerType, evalActive)
		expr := buildThresholdExpr(field, conditionOperator(c), c.Value)
		switch c.Level {
		case "info":
			info = expr
		case "warning":
			warn = expr
		case "critical":
			crit = expr
		}
	}

	taskType := rule.TaskType
	if taskType == "" {
		taskType = "stream"
	}
	if triggerType == cloudhub.AlertGroupRuleTriggerDeadman && taskType != "stream" {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: deadman trigger requires stream task")
	}
	if triggerType == cloudhub.AlertGroupRuleTriggerRelative && taskType != "stream" {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: relative trigger currently requires stream task")
	}

	hostLambda, hostSQL := buildHostFilters(hostnames)
	// Lambda helpers consume rule.Field directly. For relative trigger the
	// field is `relative_value`; for eval it's the alias. Build a "lambda
	// view" of the rule once and reuse for occurrence / exclusive builders.
	lambdaRule := rule
	lambdaRule.Field = resolveLambdaField(rule, triggerType, evalActive)
	if triggerType == cloudhub.AlertGroupRuleTriggerRelative {
		sourceVar = "relative_src"
	}
	occLambda := buildOccurrenceLambda(lambdaRule)
	occEnabled := rule.OccurrenceCount > 1 && occLambda != ""
	recentEnabled := occEnabled && isRecentOccurrence(rule.OccurrenceType)
	consecutiveEnabled := occEnabled && !recentEnabled

	// Email branches must use level-exclusive lambdas so a CRIT-matching value
	// does not also dispatch the WARN email (and similarly for INFO).
	emailInfo, emailWarn, emailCrit := buildExclusiveLambdas(lambdaRule)

	recent := recentOccurrenceParams{}
	switch {
	case recentEnabled:
		recent = buildRecentOccurrenceParams(rule, sourceVar, info, warn, crit, emailInfo, emailWarn, emailCrit)
		info, warn, crit = recent.infoCountLambda, recent.warnCountLambda, recent.critCountLambda
		emailInfo, emailWarn, emailCrit = recent.emailInfoCountLambda, recent.emailWarnCountLambda, recent.emailCritCountLambda
	case consecutiveEnabled:
		// Pure stateCount guard. occurrenceWindow is intentionally ignored here —
		// see docs/alert_group_consecutive_window.md for the rationale.
		wrap := func(s string) string {
			if s == "" {
				return ""
			}
			return fmt.Sprintf(`"state_count" >= %d AND (%s)`, rule.OccurrenceCount, s)
		}
		info, warn, crit = wrap(info), wrap(warn), wrap(crit)
		emailInfo, emailWarn, emailCrit = wrap(emailInfo), wrap(emailWarn), wrap(emailCrit)
	}
	notificationHandlers, err := nonEmailEventHandlerServices(rule.EventHandlers)
	if err != nil {
		return "", err
	}
	params := alertGroupTickParams{
		Name:                 rule.Name,
		Measurement:          rule.Measurement,
		Field:                rule.Field,
		Every:                rule.Every,
		Info:                 info,
		Warn:                 warn,
		Crit:                 crit,
		EmailInfo:            emailInfo,
		EmailWarn:            emailWarn,
		EmailCrit:            emailCrit,
		PauseDuration:        formatPauseDuration(rule.PauseSeconds),
		NotifyRecovery:       rule.NotifyRecovery,
		TriggerType:          triggerType,
		SourceVar:            sourceVar,
		RelativeEnabled:      triggerType == cloudhub.AlertGroupRuleTriggerRelative,
		RelativeBlock:        buildRelativeBlock(rule),
		DeadmanEnabled:       triggerType == cloudhub.AlertGroupRuleTriggerDeadman,
		DeadmanPeriod:        deadmanPeriod(rule.TriggerValues.Period),
		OccurrenceEnabled:    consecutiveEnabled,
		RecentEnabled:        recentEnabled,
		OccurrenceCount:      rule.OccurrenceCount,
		OccurrenceWindow:     occurrenceWindow(rule.OccurrenceWindow),
		OccurrenceLambda:     occLambda,
		RecentBlock:          recent.block,
		Message:              tickString(rule.Message),
		EmailBody:            tickEmailBody(emailBodyFromHandlers(rule.EventHandlers)),
		NotificationHandlers: notificationHandlers,
		TaskID:               "alert-group-" + rule.ID,
		OutputDB:             rule.Database,
		OutputRP:             rule.RetentionPolicy,
		OutputMeasurement:    "cloudhub_alerts",
		RecipientsInfo:       recipients.Info,
		RecipientsWarn:       recipients.Warn,
		RecipientsCrit:       recipients.Crit,
		RecipientsAll:        unionRecipients(recipients),
		HostFilterLambda:     hostLambda,
		HostFilterSQL:        hostSQL,
	}
	if evalActive {
		params.EvalEnabled = true
		params.EvalExpression = rule.Eval.Expression
		params.EvalAs = rule.Eval.As
	}
	if derivativeActive {
		params.DerivativeEnabled = true
		// Derivative reads from the eval alias if eval ran first, else the raw field.
		if evalActive {
			params.DerivativeField = rule.Eval.As
		} else {
			params.DerivativeField = rule.Field
		}
		params.DerivativeNonNegative = rule.Derivative.NonNegative
		params.DerivativeUnit = strings.TrimSpace(rule.Derivative.Unit)
		if params.DerivativeUnit == "" {
			params.DerivativeUnit = "1s"
		}
	}

	rawToml, err := tmplstore.Asset("alert_group_tick.toml")
	if err != nil {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: template asset not found: %w", err)
	}

	const marker = "template = \"\"\""
	startIdx := bytes.Index(rawToml, []byte(marker))
	if startIdx < 0 {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: malformed template asset")
	}
	startIdx += len(marker)
	endIdx := bytes.LastIndex(rawToml[startIdx:], []byte("\"\"\""))
	if endIdx < 0 {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: malformed template asset (no closing triple-quote)")
	}
	tmplStr := string(rawToml[startIdx : startIdx+endIdx])

	tmpl, err := template.New("alert-group-task").Parse(tmplStr)
	if err != nil {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, taskType, params); err != nil {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: execute template %q: %w", taskType, err)
	}
	return buf.String(), nil
}

func nonEmailEventHandlerServices(handlers []cloudhub.AlertRuleEventHandler) (string, error) {
	var nodes cloudhub.AlertNodes
	has := false
	for _, h := range handlers {
		if !h.Enabled {
			continue
		}
		cfg := h.ConfigJSON
		if len(cfg) == 0 {
			cfg = []byte(`{}`)
		}
		switch strings.ToLower(strings.TrimSpace(h.Type)) {
		case cloudhub.AlertRuleEventHandlerTCP:
			var v cloudhub.TCP
			if err := json.Unmarshal(cfg, &v); err != nil {
				return "", err
			}
			nodes.TCPs = append(nodes.TCPs, &v)
			has = true
		case cloudhub.AlertRuleEventHandlerExec:
			var v cloudhub.Exec
			if err := json.Unmarshal(cfg, &v); err != nil {
				return "", err
			}
			nodes.Exec = append(nodes.Exec, &v)
			has = true
		case cloudhub.AlertRuleEventHandlerLog:
			var v cloudhub.Log
			if err := json.Unmarshal(cfg, &v); err != nil {
				return "", err
			}
			nodes.Log = append(nodes.Log, &v)
			has = true
		case cloudhub.AlertRuleEventHandlerKafka:
			var v cloudhub.Kafka
			if err := json.Unmarshal(cfg, &v); err != nil {
				return "", err
			}
			nodes.Kafka = append(nodes.Kafka, &v)
			has = true
		case cloudhub.AlertRuleEventHandlerSlack:
			var v cloudhub.Slack
			if err := json.Unmarshal(cfg, &v); err != nil {
				return "", err
			}
			nodes.Slack = append(nodes.Slack, &v)
			has = true
		case cloudhub.AlertRuleEventHandlerTelegram:
			var v cloudhub.Telegram
			if err := json.Unmarshal(cfg, &v); err != nil {
				return "", err
			}
			nodes.Telegram = append(nodes.Telegram, &v)
			has = true
		}
	}
	if !has {
		return "", nil
	}
	return AlertServices(cloudhub.AlertRule{AlertNodes: nodes})
}

func emailBodyFromHandlers(handlers []cloudhub.AlertRuleEventHandler) string {
	for _, h := range handlers {
		if h.Type != cloudhub.AlertRuleEventHandlerEmail || !h.Enabled || len(h.ConfigJSON) == 0 {
			continue
		}
		var cfg struct {
			Body string `json:"body"`
		}
		if err := json.Unmarshal(h.ConfigJSON, &cfg); err != nil {
			continue
		}
		return strings.TrimSpace(cfg.Body)
	}
	return ""
}

func tickString(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `'`, `\'`)
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\n", `\n`)
	return s
}

// tickEmailBody escapes an HTML email body for embedding in a TICKscript
// single-quoted string. Unlike tickString it collapses real newlines into a
// single space rather than the literal `\n` sequence — TICK single-quoted
// strings do not interpret escape sequences, so a literal `\n` would survive
// untouched into the rendered email body. HTML treats consecutive whitespace
// as one space, so collapsing produces identical visual output without the
// visible "\n" artifacts.
func tickEmailBody(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `'`, `\'`)
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\n", " ")
	return s
}

type recentOccurrenceParams struct {
	block                string
	infoCountLambda      string
	warnCountLambda      string
	critCountLambda      string
	emailInfoCountLambda string
	emailWarnCountLambda string
	emailCritCountLambda string
}

type recentCountSpec struct {
	name       string
	expr       string
	countField string
}

func buildRecentOccurrenceParams(rule cloudhub.AlertGroupRule, sourceVar, info, warn, crit, emailInfo, emailWarn, emailCrit string) recentOccurrenceParams {
	var specs []recentCountSpec
	add := func(expr, name, countField string) string {
		if expr == "" {
			return ""
		}
		specs = append(specs, recentCountSpec{name: name, expr: expr, countField: countField})
		return fmt.Sprintf(`"%s" >= %d`, countField, rule.OccurrenceCount)
	}

	p := recentOccurrenceParams{}
	p.infoCountLambda = add(info, "info", "info_count")
	p.warnCountLambda = add(warn, "warn", "warn_count")
	p.critCountLambda = add(crit, "crit", "crit_count")
	p.emailInfoCountLambda = add(emailInfo, "email_info", "email_info_count")
	p.emailWarnCountLambda = add(emailWarn, "email_warn", "email_warn_count")
	p.emailCritCountLambda = add(emailCrit, "email_crit", "email_crit_count")
	p.block = buildRecentOccurrenceBlock(rule, sourceVar, specs)
	return p
}

func buildRecentOccurrenceBlock(rule cloudhub.AlertGroupRule, sourceVar string, specs []recentCountSpec) string {
	if len(specs) == 0 {
		return "var processed = " + sourceVar
	}
	window := occurrenceWindow(rule.OccurrenceWindow)
	every := strings.TrimSpace(rule.Every)
	if every == "" {
		every = "30s"
	}

	var b strings.Builder
	for _, s := range specs {
		fmt.Fprintf(&b, `var recent_%s = %s
    |eval(lambda: if(%s, 1, 0))
        .as('%s_hit')
    |window()
        .period(%s)
        .every(%s)
        .align()
    |sum('%s_hit')
        .as('%s')

`, s.name, sourceVar, s.expr, s.name, window, every, s.name, s.countField)
	}
	if len(specs) == 1 {
		fmt.Fprintf(&b, "var processed = recent_%s", specs[0].name)
		return b.String()
	}

	fmt.Fprintf(&b, "var processed = recent_%s\n", specs[0].name)
	fmt.Fprint(&b, "    |join(")
	for i, s := range specs[1:] {
		if i > 0 {
			fmt.Fprint(&b, ", ")
		}
		fmt.Fprintf(&b, "recent_%s", s.name)
	}
	fmt.Fprint(&b, ")\n        .as(")
	for i, s := range specs {
		if i > 0 {
			fmt.Fprint(&b, ", ")
		}
		fmt.Fprintf(&b, "'%s'", s.name)
	}
	fmt.Fprint(&b, ")\n        .tolerance(1s)\n    |eval(")
	for i, s := range specs {
		if i > 0 {
			fmt.Fprint(&b, ", ")
		}
		fmt.Fprintf(&b, `lambda: "%s.%s"`, s.name, s.countField)
	}
	fmt.Fprint(&b, ")\n        .as(")
	for i, s := range specs {
		if i > 0 {
			fmt.Fprint(&b, ", ")
		}
		fmt.Fprintf(&b, "'%s'", s.countField)
	}
	fmt.Fprint(&b, ")")
	return b.String()
}

func isRecentOccurrence(t string) bool {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "recent", "total":
		return true
	default:
		return false
	}
}

func occurrenceWindow(w string) string {
	w = strings.TrimSpace(w)
	if w == "" {
		return "5m"
	}
	return w
}

func deadmanPeriod(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return "10m"
	}
	return p
}

func buildRelativeBlock(rule cloudhub.AlertGroupRule) string {
	shift := strings.TrimSpace(rule.TriggerValues.Shift)
	if shift == "" {
		shift = "1m"
	}
	var expr string
	var zeroGuard string
	switch strings.TrimSpace(rule.TriggerValues.Change) {
	case ChangePercent:
		expr = fmt.Sprintf(`abs(float("current.%s" - "past.%s"))/float("past.%s") * 100.0`, rule.Field, rule.Field, rule.Field)
		zeroGuard = fmt.Sprintf(`
    |where(lambda: "past.%s" != 0.0)`, rule.Field)
	default:
		expr = fmt.Sprintf(`float("current.%s" - "past.%s")`, rule.Field, rule.Field)
	}
	return fmt.Sprintf(`var past = src
    |shift(%s)

var current = src

var relative_src = past
    |join(current)
        .as('past', 'current')
        .tolerance(2s)
%s
    |eval(lambda: %s)
        .keep()
        .as('relative_value')`, shift, zeroGuard, expr)
}

// buildHostFilters returns the host filter expressions for stream (TICKscript
// lambda) and batch (SQL WHERE AND-clause) modes. Empty list -> empty strings
// which the template treats as "all hosts".
func buildHostFilters(hostnames []string) (lambda, sqlAnd string) {
	if len(hostnames) == 0 {
		return "", ""
	}
	lambdaParts := make([]string, 0, len(hostnames))
	sqlParts := make([]string, 0, len(hostnames))
	for _, h := range hostnames {
		if h == "" {
			continue
		}
		esc := strings.ReplaceAll(h, "'", "\\'")
		lambdaParts = append(lambdaParts, fmt.Sprintf(`"host" == '%s'`, esc))
		sqlParts = append(sqlParts, fmt.Sprintf(`"host" = '%s'`, esc))
	}
	if len(lambdaParts) == 0 {
		return "", ""
	}
	return strings.Join(lambdaParts, " OR "),
		" AND (" + strings.Join(sqlParts, " OR ") + ")"
}

// resolveLambdaField returns the field name that threshold lambdas should
// reference. Order of precedence:
//  1. relative trigger → `relative_value` (eval/derivative are ignored — relative
//     handles its own derived value via shift+join+eval into `relative_value`).
//  2. eval active → the eval alias (`EvalConfig.As`). `.keep()` preserves the
//     raw field but the alert pipeline targets the derived value.
//  3. otherwise → `rule.Field` (raw or post-derivative; derivative keeps the
//     same field name by default).
func resolveLambdaField(rule cloudhub.AlertGroupRule, triggerType string, evalActive bool) string {
	if triggerType == cloudhub.AlertGroupRuleTriggerRelative {
		return "relative_value"
	}
	if evalActive {
		return rule.Eval.As
	}
	return rule.Field
}

// formatPauseDuration maps pause_seconds → argument string for stateChangesOnly().
// 0 (or negative) returns empty string so the template renders the no-arg form.
func formatPauseDuration(secs int) string {
	if secs <= 0 {
		return ""
	}
	return fmt.Sprintf("%ds", secs)
}

// buildOccurrenceLambda returns the stateCount guard. When every enabled
// condition uses the same range direction, it keeps the compact historic
// "most permissive threshold" form; mixed operators are represented as ORs.
func buildOccurrenceLambda(rule cloudhub.AlertGroupRule) string {
	var enabled []cloudhub.AlertRuleCondition
	for _, c := range rule.Conditions {
		if !c.Enabled {
			continue
		}
		c.Operator = conditionOperator(c)
		enabled = append(enabled, c)
	}
	if len(enabled) == 0 {
		return ""
	}

	firstOp := enabled[0].Operator
	allSame := true
	for _, c := range enabled[1:] {
		if c.Operator != firstOp {
			allSame = false
			break
		}
	}
	if allSame {
		best := enabled[0].Value
		for _, c := range enabled[1:] {
			switch firstOp {
			case cloudhub.AlertConditionOperatorLess, cloudhub.AlertConditionOperatorLessEqual:
				if c.Value > best {
					best = c.Value
				}
			default:
				if c.Value < best {
					best = c.Value
				}
			}
		}
		return buildThresholdExpr(rule.Field, firstOp, best)
	}

	parts := make([]string, 0, len(enabled))
	for _, c := range enabled {
		parts = append(parts, buildThresholdExpr(rule.Field, c.Operator, c.Value))
	}
	return strings.Join(parts, " OR ")
}

func conditionOperator(c cloudhub.AlertRuleCondition) string {
	return cloudhub.NormalizeAlertConditionOperator(c.Operator)
}

func conditionByLevel(conditions []cloudhub.AlertRuleCondition, level string) (cloudhub.AlertRuleCondition, bool) {
	for _, c := range conditions {
		if c.Enabled && c.Level == level {
			c.Operator = conditionOperator(c)
			return c, true
		}
	}
	return cloudhub.AlertRuleCondition{}, false
}

func appendHigherSeverityGuards(expr, field string, conditions ...cloudhub.AlertRuleCondition) string {
	for _, c := range conditions {
		expr += " AND " + buildThresholdExpr(field, inverseOperator(c.Operator), c.Value)
	}
	return expr
}

// buildExclusiveLambdas returns level-exclusive lambdas for the email branches
// so a value matching multiple thresholds only fires the highest-severity email
// branch. Uses range comparisons (inverse-operator on higher-severity thresholds)
// rather than NOT (...) since Kapacitor's lambda parser rejects the latter.
func buildExclusiveLambdas(rule cloudhub.AlertGroupRule) (eInfo, eWarn, eCrit string) {
	info, hasInfo := conditionByLevel(rule.Conditions, "info")
	warn, hasWarn := conditionByLevel(rule.Conditions, "warning")
	crit, hasCrit := conditionByLevel(rule.Conditions, "critical")

	if hasCrit {
		eCrit = buildThresholdExpr(rule.Field, crit.Operator, crit.Value)
	}
	if hasWarn {
		eWarn = buildThresholdExpr(rule.Field, warn.Operator, warn.Value)
		if hasCrit {
			eWarn = appendHigherSeverityGuards(eWarn, rule.Field, crit)
		}
	}
	if hasInfo {
		eInfo = buildThresholdExpr(rule.Field, info.Operator, info.Value)
		var higher []cloudhub.AlertRuleCondition
		if hasWarn {
			higher = append(higher, warn)
		}
		if hasCrit {
			higher = append(higher, crit)
		}
		eInfo = appendHigherSeverityGuards(eInfo, rule.Field, higher...)
	}
	return
}

// inverseOperator returns the comparison operator that, paired with the same
// threshold value, expresses the negation of the original predicate.
// Examples: greater ↔ less_equal; less_equal ↔ greater.
func inverseOperator(op string) string {
	switch op {
	case cloudhub.AlertConditionOperatorGreater:
		return cloudhub.AlertConditionOperatorLessEqual
	case cloudhub.AlertConditionOperatorGreaterEqual:
		return cloudhub.AlertConditionOperatorLess
	case cloudhub.AlertConditionOperatorLess:
		return cloudhub.AlertConditionOperatorGreaterEqual
	case cloudhub.AlertConditionOperatorLessEqual:
		return cloudhub.AlertConditionOperatorGreater
	case cloudhub.AlertConditionOperatorEqual:
		return cloudhub.AlertConditionOperatorNotEqual
	case cloudhub.AlertConditionOperatorNotEqual:
		return cloudhub.AlertConditionOperatorEqual
	}
	return cloudhub.AlertConditionOperatorGreater
}

// unionRecipients merges info/warn/crit lists into a single dedup'd list,
// preserving first-seen order. Used to address the recovery email.
func unionRecipients(r AlertRecipients) []string {
	seen := map[string]bool{}
	var out []string
	add := func(addrs []string) {
		for _, a := range addrs {
			k := strings.ToLower(strings.TrimSpace(a))
			if k == "" || seen[k] {
				continue
			}
			seen[k] = true
			out = append(out, a)
		}
	}
	add(r.Crit)
	add(r.Warn)
	add(r.Info)
	return out
}

// buildThresholdExpr returns a TICKscript lambda expression string.
func buildThresholdExpr(field, operator string, value float64) string {
	op := map[string]string{
		cloudhub.AlertConditionOperatorGreater:      ">",
		cloudhub.AlertConditionOperatorLess:         "<",
		cloudhub.AlertConditionOperatorEqual:        "==",
		cloudhub.AlertConditionOperatorNotEqual:     "!=",
		cloudhub.AlertConditionOperatorGreaterEqual: ">=",
		cloudhub.AlertConditionOperatorLessEqual:    "<=",
	}[operator]
	if op == "" {
		op = ">"
	}
	return fmt.Sprintf(`"%s" %s %s`, field, op, strconv.FormatFloat(value, 'f', -1, 64))
}
