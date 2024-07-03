package kapacitor

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"text/template"

	"github.com/pelletier/go-toml/v2"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// TomlTemplateConfig holds the configuration for Toml templates
type TomlTemplateConfig struct {
	LearnTask struct {
		Template string `toml:"template"`
	} `toml:"learn_task"`
	PredictionTask struct {
		Template string `toml:"template"`
	} `toml:"prediction_task"`
}

const (
	// LearnTaskField represents the learn_task template field
	LearnTaskField cloudhub.TemplateFieldType = "LearnTask"
	// PredictionTaskField represents the prediction_task template field
	PredictionTaskField cloudhub.TemplateFieldType = "PredictionTask"
)

// getDefaultTemplatePath returns the default path to the template file based on the workspace environment variable
func getDefaultTemplatePath() string {
	//Todo: update ${workspace}/backend/canned
	return filepath.Join("../../", "canned", "tickscript_templates.toml")
}

// LoadTemplate loads and parses the template from the given file path and field type
func LoadTemplate(config cloudhub.LoadTemplateConfig) (*template.Template, error) {
	// Use default template path if none is provided
	if config.Path == nil {
		defaultPath := getDefaultTemplatePath()
		config.Path = &defaultPath
	}

	content, err := os.ReadFile(*config.Path)
	if err != nil {
		return nil, fmt.Errorf("error reading file: %v", err)
	}
	var tomlConfig TomlTemplateConfig
	err = toml.Unmarshal(content, &tomlConfig)
	if err != nil {
		return nil, fmt.Errorf("error parsing TOML: %v", err)
	}

	v := reflect.ValueOf(tomlConfig)
	field := v.FieldByName(string(config.Field))
	if !field.IsValid() {
		return nil, fmt.Errorf("unknown template field: %s", config.Field)
	}

	templateString := field.FieldByName("Template").String()
	if templateString == "" {
		return nil, fmt.Errorf("template string is empty for field: %s", config.Field)
	}

	tmpl, err := template.New(string(config.Field)).Parse(templateString)
	if err != nil {
		return nil, fmt.Errorf("error parsing template: %v", err)
	}

	return tmpl, nil
}
