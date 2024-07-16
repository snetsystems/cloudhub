package server

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/filestore"
	template "github.com/snetsystems/cloudhub/backend/templates"
)

// ConfigTemplatesManager manages configuration templates
type ConfigTemplatesManager struct {
	Logger cloudhub.Logger
	Path   string
}

// NewConfigTemplatesManager creates a new ConfigTemplatesManager
func NewConfigTemplatesManager(path string, logger cloudhub.Logger) *ConfigTemplatesManager {
	return &ConfigTemplatesManager{
		Logger: logger,
		Path:   path,
	}
}

// All returns the set of all templates
func (manager *ConfigTemplatesManager) All(ctx context.Context) ([]cloudhub.ConfigTemplate, error) {
	templateMap := make(map[string]cloudhub.ConfigTemplate)

	// Load templates from filesystem
	filesystemTemplates, err := filestore.NewConfigTemplates(manager.Path, manager.Logger).All(ctx)
	if err != nil {
		manager.Logger.
			WithField("component", "templates").
			Error("Unable to load filesystem templates: ", err)
	} else {
		for _, tmpl := range filesystemTemplates {
			templateMap[tmpl.ID] = tmpl
		}
	}

	// Load templates from binary
	binTemplatesStore := template.BinConfigTemplatesStore{
		Logger: manager.Logger,
	}
	binaryTemplates, err := binTemplatesStore.All(ctx)
	if err != nil {
		manager.Logger.
			WithField("component", "templates").
			Error("Unable to load binary templates: ", err)
	} else {
		for _, tmpl := range binaryTemplates {
			if _, exists := templateMap[tmpl.ID]; !exists {
				templateMap[tmpl.ID] = tmpl
			}
		}
	}

	// Convert map to slice
	var templates []cloudhub.ConfigTemplate
	for _, tmpl := range templateMap {
		templates = append(templates, tmpl)
	}

	// Check if no templates were loaded at all
	if len(templates) == 0 {
		return nil, cloudhub.ErrTemplateNotFound
	}

	return templates, nil
}

// Get retrieves a ConfigTemplate by ID from the first available source
func (manager *ConfigTemplatesManager) Get(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
	// Try to get template from filesystem
	filesystemStore := filestore.NewConfigTemplates(manager.Path, manager.Logger)
	templates, err := filesystemStore.Get(ctx, id)
	if err == nil {
		return templates, nil
	}

	// Try to get template from binary
	binStore := &template.BinConfigTemplatesStore{
		Logger: manager.Logger,
	}
	templates, err = binStore.Get(ctx, id)
	if err == nil {
		return templates, nil
	}

	manager.Logger.
		WithField("component", "templates").
		WithField("name", id).
		Error("Template not found")

	return cloudhub.ConfigTemplate{}, cloudhub.ErrTemplateNotFound
}
