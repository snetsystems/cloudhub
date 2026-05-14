package kapacitor

import (
	"bytes"
	"fmt"
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
	Info              string
	Warn              string
	Crit              string
	StateChangesOnly  bool
	Message           string
	TaskID            string
	OutputDB          string
	OutputRP          string
	OutputMeasurement string
	RecipientsInfo    []string
	RecipientsWarn    []string
	RecipientsCrit    []string
	HostFilterLambda  string // stream: `"host" == 'a' OR "host" == 'b'`; empty = all hosts
	HostFilterSQL     string // batch:  ` AND ("host" = 'a' OR "host" = 'b')`; empty = all hosts
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
	params := alertGroupTickParams{
		Name:              rule.Name,
		Measurement:       rule.Measurement,
		Field:             rule.Field,
		Every:             rule.Every,
		Info:              info,
		Warn:              warn,
		Crit:              crit,
		StateChangesOnly:  rule.NotifyRecovery,
		Message:           rule.Message,
		TaskID:            "alert-group-" + rule.ID,
		OutputDB:          rule.Database,
		OutputRP:          rule.RetentionPolicy,
		OutputMeasurement: "cloudhub_alerts",
		RecipientsInfo:    recipients.Info,
		RecipientsWarn:    recipients.Warn,
		RecipientsCrit:    recipients.Crit,
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

// buildThresholdExpr returns a TICKscript lambda expression string.
func buildThresholdExpr(field, operator, value string) string {
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
	return fmt.Sprintf(`"%s" %s %s`, field, op, value)
}
