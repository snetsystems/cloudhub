package kapacitor

import (
	"bytes"
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
	Name              string
	Measurement       string
	Field             string
	Every             string
	Info              string // main-trigger lambda (Kapacitor picks highest matching level)
	Warn              string
	Crit              string
	EmailInfo         string // email-branch lambda, exclusive of higher levels
	EmailWarn         string
	EmailCrit         string
	PauseDuration     string // "" = no reminder; otherwise like "10s" — argument to stateChangesOnly()
	NotifyRecovery    bool   // true => emit a recovery email when level returns to OK
	OccurrenceEnabled bool   // true when OccurrenceCount > 1 (apply stateCount wrap)
	RecentEnabled     bool   // true when OccurrenceType asks for windowed recent counts
	OccurrenceCount   int    // N consecutive points required to trigger
	OccurrenceWindow  string // window duration for recent occurrence mode
	OccurrenceLambda  string // stateCount lambda — typically the most permissive enabled threshold
	RecentBlock       string
	Message           string
	TaskID            string
	OutputDB          string
	OutputRP          string
	OutputMeasurement string
	RecipientsInfo    []string
	RecipientsWarn    []string
	RecipientsCrit    []string
	RecipientsAll     []string // union (dedup'd, case-insensitive) of all level recipient lists — used for recovery email
	HostFilterLambda  string   // stream: `"host" == 'a' OR "host" == 'b'`; empty = all hosts
	HostFilterSQL     string   // batch:  ` AND ("host" = 'a' OR "host" = 'b')`; empty = all hosts
}

// AlertGroupRuleTICKScript generates a TICKscript for an AlertGroupRule.
// Recipients are baked into the script via Kapacitor's native email() handler.
// Hostnames are inlined as a where() / SQL WHERE filter; an empty list means all hosts.
func AlertGroupRuleTICKScript(rule cloudhub.AlertGroupRule, recipients AlertRecipients, hostnames []string) (string, error) {
	if rule.ID == "" {
		return "", fmt.Errorf("AlertGroupRuleTICKScript: rule ID required")
	}

	var info, warn, crit string
	for _, c := range rule.Conditions {
		if !c.Enabled {
			continue
		}
		expr := buildThresholdExpr(rule.Field, rule.TriggerOperator, c.Value)
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

	hostLambda, hostSQL := buildHostFilters(hostnames)
	occLambda := buildOccurrenceLambda(rule)
	occEnabled := rule.OccurrenceCount > 1 && occLambda != ""
	recentEnabled := occEnabled && isRecentOccurrence(rule.OccurrenceType)
	consecutiveEnabled := occEnabled && !recentEnabled

	// Email branches must use level-exclusive lambdas so a CRIT-matching value
	// does not also dispatch the WARN email (and similarly for INFO).
	emailInfo, emailWarn, emailCrit := buildExclusiveLambdas(rule)

	recent := recentOccurrenceParams{}
	if recentEnabled {
		recent = buildRecentOccurrenceParams(rule, info, warn, crit, emailInfo, emailWarn, emailCrit)
		info, warn, crit = recent.infoCountLambda, recent.warnCountLambda, recent.critCountLambda
		emailInfo, emailWarn, emailCrit = recent.emailInfoCountLambda, recent.emailWarnCountLambda, recent.emailCritCountLambda
	} else if consecutiveEnabled {
		wrap := func(s string) string {
			if s == "" {
				return ""
			}
			return fmt.Sprintf(`"state_count" >= %d AND (%s)`, rule.OccurrenceCount, s)
		}
		info, warn, crit = wrap(info), wrap(warn), wrap(crit)
		emailInfo, emailWarn, emailCrit = wrap(emailInfo), wrap(emailWarn), wrap(emailCrit)
	}
	params := alertGroupTickParams{
		Name:              rule.Name,
		Measurement:       rule.Measurement,
		Field:             rule.Field,
		Every:             rule.Every,
		Info:              info,
		Warn:              warn,
		Crit:              crit,
		EmailInfo:         emailInfo,
		EmailWarn:         emailWarn,
		EmailCrit:         emailCrit,
		PauseDuration:     formatPauseDuration(rule.PauseSeconds),
		NotifyRecovery:    rule.NotifyRecovery,
		OccurrenceEnabled: consecutiveEnabled,
		RecentEnabled:     recentEnabled,
		OccurrenceCount:   rule.OccurrenceCount,
		OccurrenceWindow:  occurrenceWindow(rule.OccurrenceWindow),
		OccurrenceLambda:  occLambda,
		RecentBlock:       recent.block,
		Message:           rule.Message,
		TaskID:            "alert-group-" + rule.ID,
		OutputDB:          rule.Database,
		OutputRP:          rule.RetentionPolicy,
		OutputMeasurement: "cloudhub_alerts",
		RecipientsInfo:    recipients.Info,
		RecipientsWarn:    recipients.Warn,
		RecipientsCrit:    recipients.Crit,
		RecipientsAll:     unionRecipients(recipients),
		HostFilterLambda:  hostLambda,
		HostFilterSQL:     hostSQL,
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

func buildRecentOccurrenceParams(rule cloudhub.AlertGroupRule, info, warn, crit, emailInfo, emailWarn, emailCrit string) recentOccurrenceParams {
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
	p.block = buildRecentOccurrenceBlock(rule, specs)
	return p
}

func buildRecentOccurrenceBlock(rule cloudhub.AlertGroupRule, specs []recentCountSpec) string {
	if len(specs) == 0 {
		return "var processed = src"
	}
	window := occurrenceWindow(rule.OccurrenceWindow)
	every := strings.TrimSpace(rule.Every)
	if every == "" {
		every = "30s"
	}

	var b strings.Builder
	for _, s := range specs {
		fmt.Fprintf(&b, `var recent_%s = src
    |eval(lambda: if(%s, 1, 0))
        .as('%s_hit')
    |window()
        .period(%s)
        .every(%s)
        .align()
    |sum('%s_hit')
        .as('%s')

`, s.name, s.expr, s.name, window, every, s.name, s.countField)
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

// formatPauseDuration maps pause_seconds → argument string for stateChangesOnly().
// 0 (or negative) returns empty string so the template renders the no-arg form.
func formatPauseDuration(secs int) string {
	if secs <= 0 {
		return ""
	}
	return fmt.Sprintf("%ds", secs)
}

// buildOccurrenceLambda picks the most permissive enabled condition's threshold
// expression to use as the stateCount lambda. For `greater`/`greater_equal` ops
// the lowest value is most permissive; for `less`/`less_equal` the highest.
// Returns empty when no enabled condition exists.
func buildOccurrenceLambda(rule cloudhub.AlertGroupRule) string {
	var best float64
	has := false
	for _, c := range rule.Conditions {
		if !c.Enabled {
			continue
		}
		if !has {
			best = c.Value
			has = true
			continue
		}
		switch rule.TriggerOperator {
		case "less", "less_equal":
			if c.Value > best {
				best = c.Value
			}
		default: // greater, greater_equal, equal, not_equal
			if c.Value < best {
				best = c.Value
			}
		}
	}
	if !has {
		return ""
	}
	return buildThresholdExpr(rule.Field, rule.TriggerOperator, best)
}

// buildExclusiveLambdas returns level-exclusive lambdas for the email branches
// so a value matching multiple thresholds only fires the highest-severity email
// branch. Uses range comparisons (inverse-operator on higher-severity thresholds)
// rather than NOT (...) since Kapacitor's lambda parser rejects the latter.
//
// Examples (greater operator, info=30 warn=60 crit=90):
//
//	CRIT: "v" > 90
//	WARN: "v" > 60 AND "v" <= 90
//	INFO: "v" > 30 AND "v" <= 60 AND "v" <= 90
//
// CRIT lambda is unchanged (top severity). WARN/INFO are anchored by `<=` to the
// higher thresholds (or `>=` when the rule operator is `less` / `less_equal`).
func buildExclusiveLambdas(rule cloudhub.AlertGroupRule) (eInfo, eWarn, eCrit string) {
	var infoVal, warnVal, critVal float64
	var hasInfo, hasWarn, hasCrit bool
	for _, c := range rule.Conditions {
		if !c.Enabled {
			continue
		}
		switch c.Level {
		case "info":
			infoVal, hasInfo = c.Value, true
		case "warning":
			warnVal, hasWarn = c.Value, true
		case "critical":
			critVal, hasCrit = c.Value, true
		}
	}

	op := rule.TriggerOperator
	inv := inverseOperator(op)

	if hasCrit {
		eCrit = buildThresholdExpr(rule.Field, op, critVal)
	}
	if hasWarn {
		expr := buildThresholdExpr(rule.Field, op, warnVal)
		if hasCrit {
			expr += " AND " + buildThresholdExpr(rule.Field, inv, critVal)
		}
		eWarn = expr
	}
	if hasInfo {
		expr := buildThresholdExpr(rule.Field, op, infoVal)
		if hasWarn {
			expr += " AND " + buildThresholdExpr(rule.Field, inv, warnVal)
		}
		if hasCrit {
			expr += " AND " + buildThresholdExpr(rule.Field, inv, critVal)
		}
		eInfo = expr
	}
	return
}

// inverseOperator returns the comparison operator that, paired with the same
// threshold value, expresses the negation of the original predicate.
// Examples: greater ↔ less_equal; less_equal ↔ greater.
func inverseOperator(op string) string {
	switch op {
	case "greater":
		return "less_equal"
	case "greater_equal":
		return "less"
	case "less":
		return "greater_equal"
	case "less_equal":
		return "greater"
	case "equal":
		return "not_equal"
	case "not_equal":
		return "equal"
	}
	return op
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
		"greater":       ">",
		"less":          "<",
		"equal":         "==",
		"not_equal":     "!=",
		"greater_equal": ">=",
		"less_equal":    "<=",
	}[operator]
	if op == "" {
		op = ">"
	}
	return fmt.Sprintf(`"%s" %s %s`, field, op, strconv.FormatFloat(value, 'f', -1, 64))
}
