package server

import (
	"bytes"
	"fmt"
	"text/template"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// TemplateService ...
type TemplateService struct{}

const (
	// LearnTaskField represents the learn_task template field
	LearnTaskField cloudhub.TemplateFieldType = "learn-task"
	// PredictionTaskField represents the prediction_task template field
	PredictionTaskField cloudhub.TemplateFieldType = "predict-task"
	// LogstashTemplateField represents the logstash_gen template field
	LogstashTemplateField cloudhub.TemplateFieldType = "logstash-config"
)

// LoadTemplate loads and parses the template from the given file path and field type
func (s *TemplateService) LoadTemplate(config cloudhub.LoadTemplateConfig, tmplParams cloudhub.TemplateParams) (string, error) {
	templateString := config.TemplateString
	if templateString == "" {
		return "", fmt.Errorf("template string is empty for field: %s", config.Field)
	}

	tmpl, err := template.New(string(config.Field)).Parse(templateString)
	if err != nil {
		return "", fmt.Errorf("error parsing template: %v", err)
	}

	var tpl bytes.Buffer
	if err := tmpl.Execute(&tpl, tmplParams); err != nil {
		return "", err
	}

	finalTickScript := tpl.String()

	return finalTickScript, nil
}
