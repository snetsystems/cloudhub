// Package template provides functionality to work with templates
package template

import (
	"context"

	"github.com/pelletier/go-toml/v2"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// BinConfigTemplatesStore represents a template store using data generated by go-bindata
//
//go:generate go-bindata -o bin_gen.go -ignore README|apps|\\.sh$|\\.go$|bin.go|bin_gen.go -pkg template .
type BinConfigTemplatesStore struct {
	Logger cloudhub.Logger
}

// All returns the set of all templates
func (s *BinConfigTemplatesStore) All(ctx context.Context) ([]cloudhub.ConfigTemplate, error) {
	names := AssetNames()
	templates := make([]cloudhub.ConfigTemplate, len(names))
	for i, name := range names {
		octets, err := Asset(name)
		if err != nil {
			s.Logger.
				WithField("component", "templates").
				WithField("name", name).
				Error("Invalid Template: ", err)
			return nil, cloudhub.ErrTemplatesInvalid
		}

		var template cloudhub.ConfigTemplate
		if err = toml.Unmarshal(octets, &template); err != nil {
			s.Logger.
				WithField("component", "templates").
				WithField("name", name).
				Error("Unable to read template:", err)
			return nil, cloudhub.ErrTemplatesInvalid
		}
		templates[i] = template
	}

	return templates, nil
}

// Get retrieves ConfigTemplate if `ID` exists.
func (s *BinConfigTemplatesStore) Get(ctx context.Context, ID string) (cloudhub.ConfigTemplate, error) {
	templates, err := s.All(ctx)
	if err != nil {
		s.Logger.
			WithField("component", "templates").
			WithField("name", ID).
			Error("Invalid Template: ", err)
		return cloudhub.ConfigTemplate{}, cloudhub.ErrTemplatesInvalid
	}

	for _, template := range templates {
		if template.ID == ID {
			return template, nil
		}
	}

	s.Logger.
		WithField("component", "templates").
		WithField("name", ID).
		Error("Template not found")
	return cloudhub.ConfigTemplate{}, cloudhub.ErrTemplateNotFound
}