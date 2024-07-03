package kapacitor

import (
	"bytes"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.Ticker = &Alert{}

// Alert defines alerting strings in template rendering
type Alert struct{}

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

// GenerateTaskFromTemplate uses the provided template to generate a task.
func (a *Alert) GenerateTaskFromTemplate(config cloudhub.LoadTemplateConfig, tmplParams cloudhub.TemplateParams) (cloudhub.TICKScript, error) {

	tmpl, err := LoadTemplate(config)
	if err != nil {
		return "", err
	}

	var tpl bytes.Buffer
	if err := tmpl.Execute(&tpl, tmplParams); err != nil {
		return "", err
	}

	finalTickScript := tpl.String()

	return cloudhub.TICKScript(finalTickScript), nil
}
