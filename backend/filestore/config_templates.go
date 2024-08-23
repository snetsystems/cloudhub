package filestore

import (
	"context"
	"io/fs"
	"os"
	"path"

	"github.com/pelletier/go-toml/v2"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// TemplateExt is the file extension searched for in the directory for template files
const TemplateExt = ".toml"

// ConfigTemplatesStore represents a store for configuration templates stored in the filesystem
type ConfigTemplatesStore struct {
	Dir     string                                        // Dir is the directory containing the templates
	Load    func(string) (cloudhub.ConfigTemplate, error) // Load loads a template file
	ReadDir func(dirname string) ([]fs.DirEntry, error)   // ReadDir reads the directory and returns a list of directory entries
	Logger  cloudhub.Logger
}

// NewConfigTemplates creates a new ConfigTemplatesStore
func NewConfigTemplates(dir string, logger cloudhub.Logger) *ConfigTemplatesStore {
	return &ConfigTemplatesStore{
		Dir:     dir,
		Load:    loadTemplateFile,
		ReadDir: os.ReadDir,
		Logger:  logger,
	}
}

func loadTemplateFile(name string) (cloudhub.ConfigTemplate, error) {
	octets, err := os.ReadFile(name)
	if err != nil {
		return cloudhub.ConfigTemplate{}, cloudhub.ErrTemplateNotFound
	}

	var template cloudhub.ConfigTemplate
	if err = toml.Unmarshal(octets, &template); err != nil {
		return cloudhub.ConfigTemplate{}, cloudhub.ErrTemplateInvalid
	}
	return template, nil
}

// All returns all templates from the directory
func (s *ConfigTemplatesStore) All(ctx context.Context) ([]cloudhub.ConfigTemplate, error) {
	entries, err := s.ReadDir(s.Dir)
	if err != nil {
		return nil, err
	}

	templates := []cloudhub.ConfigTemplate{}
	for _, entry := range entries {
		if entry.IsDir() || path.Ext(entry.Name()) != TemplateExt {
			continue
		}
		if template, err := s.Load(path.Join(s.Dir, entry.Name())); err != nil {
			continue // We want to load all files we can.
		} else {
			templates = append(templates, template)
		}
	}
	return templates, nil
}

// Get returns a template file from the templates directory
func (s *ConfigTemplatesStore) Get(ctx context.Context, ID string) (cloudhub.ConfigTemplate, error) {
	t, file, err := s.idToFile(ID)
	if err != nil {
		if err == cloudhub.ErrTemplateNotFound {
			s.Logger.
				WithField("component", "templates").
				WithField("name", file).
				Error("Unable to read file")
		} else if err == cloudhub.ErrTemplateInvalid {
			s.Logger.
				WithField("component", "templates").
				WithField("name", file).
				Error("File is not a template")
		}
		return cloudhub.ConfigTemplate{}, err
	}
	return t, nil
}

// idToFile takes an id and finds the associated filename
func (s *ConfigTemplatesStore) idToFile(ID string) (cloudhub.ConfigTemplate, string, error) {
	entries, err := s.ReadDir(s.Dir)
	if err != nil {
		return cloudhub.ConfigTemplate{}, "", err
	}

	for _, entry := range entries {
		if entry.IsDir() || path.Ext(entry.Name()) != TemplateExt {
			continue
		}
		file := path.Join(s.Dir, entry.Name())
		template, err := s.Load(file)
		if err != nil {
			return cloudhub.ConfigTemplate{}, "", err
		}
		if template.ID == ID {
			return template, file, nil
		}
	}

	return cloudhub.ConfigTemplate{}, "", cloudhub.ErrTemplateNotFound
}
