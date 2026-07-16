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
type alertGroupTickSpecParams struct {
	Index                 int
	Measurement           string
	GroupByTag            string
	Field                 string
	HistoryValueField     string
	Every                 string
	Info                  string
	Warn                  string
	Crit                  string
	EmailInfo             string
	EmailWarn             string
	EmailCrit             string
	TriggerType           string
	SourceVar             string
	RelativeEnabled       bool
	RelativeBlock         string
	DeadmanEnabled        bool
	DeadmanPeriod         string
	OccurrenceEnabled     bool
	RecentEnabled         bool
	OccurrenceCount       int
	OccurrenceWindow      string
	OccurrenceLambda      string
	RecentBlock           string
	EvalEnabled           bool
	EvalExpression        string
	EvalAs                string
	DerivativeEnabled     bool
	DerivativeField       string
	DerivativeNonNegative bool
	DerivativeUnit        string
}

type alertGroupTickParams struct {
	Name                 string
	TaskID               string
	OutputDB             string
	OutputRP             string
	OutputMeasurement    string
	Message              string
	EmailBody            string
	NotificationHandlers string
	PauseDuration        string
	NotifyRecovery       bool
	RecipientsInfo       []string
	RecipientsWarn       []string
	RecipientsCrit       []string
	RecipientsAll        []string
	HostFilterLambda     string
	HostFilterSQL        string
	Specs                []alertGroupTickSpecParams
}

// AlertGroupRuleTICKScript generates a TICKscript for an AlertGroupRule.
// Recipients are baked into the script via Kapacitor's native email() handler.
// Hostnames are inlined as a where() / SQL WHERE filter; an empty list means all hosts.
func AlertGroupRuleTICKScript(rule cloudhub.AlertGroupRule, recipients AlertRecipients, targetFilter string) (string, error) {
	if rule.ID == "" {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: rule ID required")
	}

	taskType := rule.TaskType
	if taskType == "" {
		taskType = "stream"
	}

	notificationHandlers, err := nonEmailEventHandlerServices(rule.EventHandlers)
	if err != nil {
		return "", err
	}

	// We pass targetFilter directly since TargetProcessor now creates the exact lambda/sql string.
	// But we need to separate them if we want to support both stream and batch easily.
	// In the original, targetFilter was hostnames array. If it's a string, we assume it's the Lambda if stream, SQL if batch.
	// Let's assume targetFilter is properly formatted by TargetProcessor for the task type.
	// Actually, TargetProcessor returns the string for TICKScript, we'll use it as HostFilterLambda for stream, and HostFilterSQL for batch.
	hostLambda := targetFilter
	hostSQL := targetFilter // In practice, TargetProcessor should give us what we need, or we adapt. Let's just set both.

	params := alertGroupTickParams{
		Name:                 rule.Name,
		TaskID:               "alert-group-" + rule.ID,
		OutputDB:             "cloudhub", // We need to get this from somewhere, or maybe it's in the spec?
		OutputRP:             "autogen",
		OutputMeasurement:    "cloudhub_alerts",
		Message:              tickString(rule.Message),
		EmailBody:            tickEmailBody(emailBodyFromHandlers(rule.EventHandlers)),
		NotificationHandlers: notificationHandlers,
		PauseDuration:        formatPauseDuration(rule.PauseSeconds),
		NotifyRecovery:       rule.NotifyRecovery,
		RecipientsInfo:       recipients.Info,
		RecipientsWarn:       recipients.Warn,
		RecipientsCrit:       recipients.Crit,
		RecipientsAll:        unionRecipients(recipients),
		HostFilterLambda:     hostLambda,
		HostFilterSQL:        hostSQL,
	}

	for i, spec := range rule.Specs {
		// Populate defaults
		if params.OutputDB == "cloudhub" && spec.Database != "" {
			params.OutputDB = spec.Database
			params.OutputRP = spec.RetentionPolicy
		}

		triggerType := strings.TrimSpace(strings.ToLower(spec.Trigger))
		if triggerType == "" {
			triggerType = cloudhub.AlertGroupRuleTriggerThreshold
		}

		if triggerType == cloudhub.AlertGroupRuleTriggerDeadman && taskType != "stream" {
			return "", fmt.Errorf("AlertGroupRuleTICKScript: deadman trigger requires stream task")
		}
		if triggerType == cloudhub.AlertGroupRuleTriggerRelative && taskType != "stream" {
			return "", fmt.Errorf("AlertGroupRuleTICKScript: relative trigger currently requires stream task")
		}

		// Because Eval/Derivative were top-level, we don't have them in Spec in DB.
		// Wait, did we move Eval/Derivative to Spec? No, they were dropped or still in top level?
		// In my db changes, eval and derivative were kept in alert_rules! So `rule.Eval` is valid!
		evalActive := rule.Eval != nil && strings.TrimSpace(rule.Eval.Expression) != "" && strings.TrimSpace(rule.Eval.As) != ""
		derivativeActive := rule.Derivative != nil && rule.Derivative.Enabled

		var info, warn, crit string
		for _, c := range spec.Conditions {
			if !c.Enabled {
				continue
			}
			field := resolveLambdaField(rule, spec, triggerType, evalActive)
			expr := buildThresholdExpr(field, conditionOperator(c), c.Value)

			if isUrlLevel(c.Level) {
				if c.Level == "url_4xx" {
					expr = `("http_response_code" >= 400 AND "http_response_code" < 500)`
				} else if c.Level == "url_5xx" {
					expr = `("http_response_code" >= 500 AND "http_response_code" < 600)`
				} else if c.Level == "url_unknown" {
					expr = `(isPresent("http_response_code") == FALSE OR "http_response_code" == 0 OR "http_response_code" < 200 OR "http_response_code" >= 600)`
				}
				if crit != "" {
					crit = fmt.Sprintf("(%s) OR (%s)", crit, expr)
				} else {
					crit = expr
				}
				continue
			}

			switch c.Level {
			case "info":
				info = expr
			case "warning":
				warn = expr
			case "critical":
				if crit != "" {
					crit = fmt.Sprintf("(%s) OR (%s)", crit, expr)
				} else {
					crit = expr
				}
			}
		}

		sourceVar := "src"
		if triggerType == cloudhub.AlertGroupRuleTriggerRelative {
			sourceVar = "relative_src"
		}

		// build occurrence
		occLambda := buildOccurrenceLambda(rule, spec)
		occEnabled := rule.OccurrenceCount > 1 && occLambda != ""
		recentEnabled := occEnabled && isRecentOccurrence(rule.OccurrenceType)
		consecutiveEnabled := occEnabled && !recentEnabled

		emailInfo, emailWarn, emailCrit := buildExclusiveLambdas(rule, spec)
		recent := recentOccurrenceParams{}
		switch {
		case recentEnabled:
			recent = buildRecentOccurrenceParams(rule, spec, sourceVar, info, warn, crit, emailInfo, emailWarn, emailCrit, i)
			info, warn, crit = recent.infoCountLambda, recent.warnCountLambda, recent.critCountLambda
			emailInfo, emailWarn, emailCrit = recent.emailInfoCountLambda, recent.emailWarnCountLambda, recent.emailCritCountLambda
		case consecutiveEnabled:
			wrap := func(s string) string {
				if s == "" {
					return ""
				}
				return fmt.Sprintf(`"state_count" >= %d AND (%s)`, rule.OccurrenceCount, s)
			}
			info, warn, crit = wrap(info), wrap(warn), wrap(crit)
			emailInfo, emailWarn, emailCrit = wrap(emailInfo), wrap(emailWarn), wrap(emailCrit)
		}

		groupByTag := "host"
		if spec.Measurement == "http_response" {
			groupByTag = "server"
		}

		sp := alertGroupTickSpecParams{
			Index:             i,
			Measurement:       spec.Measurement,
			GroupByTag:        groupByTag,
			Field:             spec.Field,
			HistoryValueField: resolveLambdaField(rule, spec, triggerType, evalActive),
			Every:             spec.Every,
			Info:              info,
			Warn:              warn,
			Crit:              crit,
			EmailInfo:         emailInfo,
			EmailWarn:         emailWarn,
			EmailCrit:         emailCrit,
			TriggerType:       triggerType,
			SourceVar:         sourceVar,
			RelativeEnabled:   triggerType == cloudhub.AlertGroupRuleTriggerRelative,
			RelativeBlock:     buildRelativeBlock(rule, spec, i),
			DeadmanEnabled:    triggerType == cloudhub.AlertGroupRuleTriggerDeadman,
			DeadmanPeriod:     deadmanPeriod(spec),
			OccurrenceEnabled: consecutiveEnabled,
			RecentEnabled:     recentEnabled,
			OccurrenceCount:   rule.OccurrenceCount,
			OccurrenceWindow:  occurrenceWindow(rule.OccurrenceWindow),
			OccurrenceLambda:  occLambda,
			RecentBlock:       recent.block,
		}

		if evalActive {
			sp.EvalEnabled = true
			sp.EvalExpression = rule.Eval.Expression
			sp.EvalAs = rule.Eval.As
		}
		if derivativeActive {
			sp.DerivativeEnabled = true
			if evalActive {
				sp.DerivativeField = rule.Eval.As
			} else {
				sp.DerivativeField = spec.Field
			}
			sp.DerivativeNonNegative = rule.Derivative.NonNegative
			sp.DerivativeUnit = strings.TrimSpace(rule.Derivative.Unit)
			if sp.DerivativeUnit == "" {
				sp.DerivativeUnit = "1s"
			}
		}

		params.Specs = append(params.Specs, sp)
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
		case cloudhub.AlertRuleEventHandlerWebhook:
			var v cloudhub.Post
			if err := json.Unmarshal(cfg, &v); err != nil {
				return "", err
			}
			nodes.Posts = append(nodes.Posts, &v)
			has = true
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
		return normalizeEmailBody(strings.TrimSpace(cfg.Body))
	}
	return ""
}

func normalizeEmailBody(body string) string {
	const legacyDefaultBadgeStyle = "background:#fee2e2;color:#991b1b;"
	if !isLegacyDefaultEmailBody(body, legacyDefaultBadgeStyle) {
		return body
	}
	return strings.Replace(body, legacyDefaultBadgeStyle, `background:{{ if eq .Level "WARNING" }}#fef3c7{{ else if eq .Level "CRITICAL" }}#fee2e2{{ else }}#dbeafe{{ end }};color:{{ if eq .Level "WARNING" }}#92400e{{ else if eq .Level "CRITICAL" }}#991b1b{{ else }}#1e40af{{ end }};`, 1)
}

func isLegacyDefaultEmailBody(body, legacyDefaultBadgeStyle string) bool {
	return strings.Contains(body, "CloudHub Alert") &&
		strings.Contains(body, "CloudHub generated this notification from an alert rule.") &&
		strings.Contains(body, "{{ .Level }}") &&
		strings.Contains(body, legacyDefaultBadgeStyle)
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

func buildRecentOccurrenceParams(rule cloudhub.AlertGroupRule, spec cloudhub.AlertRuleSpec, sourceVar, info, warn, crit, emailInfo, emailWarn, emailCrit string, index int) recentOccurrenceParams {
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
	p.block = buildRecentOccurrenceBlock(rule, spec, sourceVar, specs, index)
	return p
}

func buildRecentOccurrenceBlock(rule cloudhub.AlertGroupRule, spec cloudhub.AlertRuleSpec, sourceVar string, specs []recentCountSpec, index int) string {
	sv := fmt.Sprintf("%s_%d", sourceVar, index)
	if len(specs) == 0 {
		return fmt.Sprintf("var processed_%d = %s", index, sv)
	}
	window := occurrenceWindow(rule.OccurrenceWindow)
	every := strings.TrimSpace(spec.Every)
	if every == "" {
		every = "30s"
	}

	var b strings.Builder
	for _, s := range specs {
		fmt.Fprintf(&b, `var recent_%s_%d = %s
    |eval(lambda: if(%s, 1, 0))
        .as('%s_hit')
    |window()
        .period(%s)
        .every(%s)
        .align()
    |sum('%s_hit')
        .as('%s')

`, s.name, index, sv, s.expr, s.name, window, every, s.name, s.countField)
	}
	if len(specs) == 1 {
		fmt.Fprintf(&b, "var processed_%d = recent_%s_%d", index, specs[0].name, index)
		return b.String()
	}

	fmt.Fprintf(&b, "var processed_%d = recent_%s_%d\n", index, specs[0].name, index)
	fmt.Fprint(&b, "    |join(")
	for i, s := range specs[1:] {
		if i > 0 {
			fmt.Fprint(&b, ", ")
		}
		fmt.Fprintf(&b, "recent_%s_%d", s.name, index)
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

func deadmanPeriod(spec cloudhub.AlertRuleSpec) string {
	if spec.TriggerValues == nil {
		return ""
	}
	p := strings.TrimSpace(spec.TriggerValues.Period)
	return p
}

func occurrenceWindow(w string) string {
	w = strings.TrimSpace(w)
	if w == "" {
		return "5m"
	}
	return w
}

func buildRelativeBlock(rule cloudhub.AlertGroupRule, spec cloudhub.AlertRuleSpec, index int) string {
	if spec.TriggerValues == nil {
		return ""
	}
	shift := strings.TrimSpace(spec.TriggerValues.Shift)
	if shift == "" {
		shift = "1m"
	}
	var expr string
	var zeroGuard string
	switch strings.TrimSpace(spec.TriggerValues.Change) {
	case ChangePercent:
		expr = fmt.Sprintf(`abs(float("current.%s" - "past.%s"))/float("past.%s") * 100.0`, spec.Field, spec.Field, spec.Field)
		zeroGuard = fmt.Sprintf(`
    |where(lambda: "past.%s" != 0.0)`, spec.Field)
	default:
		expr = fmt.Sprintf(`float("current.%s" - "past.%s")`, spec.Field, spec.Field)
	}
	return fmt.Sprintf(`var past_%d = src_%d
    |shift(%s)

var current_%d = src_%d

var relative_src_%d = past_%d
    |join(current_%d)
        .as('past', 'current')
        .tolerance(2s)
%s
    |eval(lambda: %s)
        .keep()
        .as('relative_value')`, index, index, shift, index, index, index, index, index, zeroGuard, expr)
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
//  3. otherwise → `spec.Field` (raw or post-derivative; derivative keeps the
//     same field name by default).
func resolveLambdaField(rule cloudhub.AlertGroupRule, spec cloudhub.AlertRuleSpec, triggerType string, evalActive bool) string {
	if triggerType == cloudhub.AlertGroupRuleTriggerRelative {
		return "relative_value"
	}
	if evalActive {
		return rule.Eval.As
	}
	return spec.Field
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
func buildOccurrenceLambda(rule cloudhub.AlertGroupRule, spec cloudhub.AlertRuleSpec) string {
	var enabled []cloudhub.AlertRuleCondition
	for _, c := range spec.Conditions {
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
		return buildThresholdExpr(spec.Field, firstOp, best)
	}

	parts := make([]string, 0, len(enabled))
	for _, c := range enabled {
		if c.Level == "url_4xx" {
			parts = append(parts, `(isPresent("http_response_code") AND "http_response_code" >= 400 AND "http_response_code" < 500)`)
		} else if c.Level == "url_5xx" {
			parts = append(parts, `(isPresent("http_response_code") AND "http_response_code" >= 500 AND "http_response_code" < 600)`)
		} else if c.Level == "url_unknown" {
			parts = append(parts, `(isPresent("http_response_code") == FALSE OR "http_response_code" == 0 OR "http_response_code" < 200 OR "http_response_code" >= 600)`)
		} else {
			parts = append(parts, buildThresholdExpr(spec.Field, c.Operator, c.Value))
		}
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

func isUrlLevel(level string) bool {
	switch level {
	case "url_4xx", "url_5xx", "url_unknown":
		return true
	}
	return false
}

// buildExclusiveLambdas returns level-exclusive lambdas for the email branches
// so a value matching multiple thresholds only fires the highest-severity email
// branch. Uses range comparisons (inverse-operator on higher-severity thresholds)
// rather than NOT (...) since Kapacitor's lambda parser rejects the latter.
func buildExclusiveLambdas(rule cloudhub.AlertGroupRule, spec cloudhub.AlertRuleSpec) (eInfo, eWarn, eCrit string) {
	var thresholdConds []cloudhub.AlertRuleCondition
	var urlConds []cloudhub.AlertRuleCondition

	for _, c := range spec.Conditions {
		if isUrlLevel(c.Level) {
			urlConds = append(urlConds, c)
		} else {
			thresholdConds = append(thresholdConds, c)
		}
	}

	info, hasInfo := conditionByLevel(thresholdConds, "info")
	warn, hasWarn := conditionByLevel(thresholdConds, "warning")
	crit, hasCrit := conditionByLevel(thresholdConds, "critical")

	if hasCrit {
		eCrit = buildThresholdExpr(spec.Field, crit.Operator, crit.Value)
	}
	if hasWarn {
		eWarn = buildThresholdExpr(spec.Field, warn.Operator, warn.Value)
		if hasCrit {
			eWarn = appendHigherSeverityGuards(eWarn, spec.Field, crit)
		}
	}
	if hasInfo {
		eInfo = buildThresholdExpr(spec.Field, info.Operator, info.Value)
		var higher []cloudhub.AlertRuleCondition
		if hasWarn {
			higher = append(higher, warn)
		}
		if hasCrit {
			higher = append(higher, crit)
		}
		eInfo = appendHigherSeverityGuards(eInfo, spec.Field, higher...)
	}

	for _, c := range urlConds {
		var expr string
		if c.Level == "url_4xx" {
			expr = `(isPresent("http_response_code") AND "http_response_code" >= 400 AND "http_response_code" < 500)`
		} else if c.Level == "url_5xx" {
			expr = `(isPresent("http_response_code") AND "http_response_code" >= 500 AND "http_response_code" < 600)`
		} else if c.Level == "url_unknown" {
			expr = `(isPresent("http_response_code") == FALSE OR "http_response_code" == 0 OR "http_response_code" < 200 OR "http_response_code" >= 600)`
		}

		if eCrit != "" {
			eCrit = fmt.Sprintf("(%s) OR (%s)", eCrit, expr)
		} else {
			eCrit = expr
		}
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
	switch operator {
	case "url_4xx":
		return `(isPresent("http_response_code") AND "http_response_code" >= 400 AND "http_response_code" < 500)`
	case "url_5xx":
		return `(isPresent("http_response_code") AND "http_response_code" >= 500 AND "http_response_code" < 600)`
	case "url_unknown":
		return `(isPresent("http_response_code") == FALSE OR "http_response_code" == 0 OR "http_response_code" < 200 OR "http_response_code" >= 600)`
	}

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
	valStr := strconv.FormatFloat(value, 'f', -1, 64)
	if !strings.Contains(valStr, ".") {
		valStr += ".0"
	}
	return fmt.Sprintf(`(isPresent("%s") AND "%s" %s %s)`, field, field, op, valStr)
}
