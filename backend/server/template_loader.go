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
	LogstashTemplateField cloudhub.TemplateFieldType = "logstash-snmp_nx"
)

// LoadTemplate loads and parses the template from the given file path and field type
func (s *TemplateService) LoadTemplate(config cloudhub.LoadTemplateConfig, tmplParams []cloudhub.TemplateBlock) (string, error) {
	tmpl, err := template.New(string(config.Field)).Parse(config.TemplateString)
	if err != nil {
		return "", fmt.Errorf("error parsing template: %v", err)
	}

	var finalBuffer bytes.Buffer

	for _, block := range tmplParams {
		var tpl bytes.Buffer
		if err := tmpl.ExecuteTemplate(&tpl, block.Name, block.Params); err != nil {
			return "", fmt.Errorf("error executing template for block %s: %v", block.Name, err)
		}

		finalBuffer.WriteString(tpl.String())
		finalBuffer.WriteString("\n")
	}

	finalString := finalBuffer.String()

	return finalString, nil
}
