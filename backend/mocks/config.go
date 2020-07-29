package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ConfigStore stores global application configuration
type ConfigStore struct {
	Config *cloudhub.Config
}

// Initialize is noop in mocks store
func (c ConfigStore) Initialize(ctx context.Context) error {
	return nil
}

// Get returns the whole global application configuration
func (c ConfigStore) Get(ctx context.Context) (*cloudhub.Config, error) {
	return c.Config, nil
}

// Update updates the whole global application configuration
func (c ConfigStore) Update(ctx context.Context, config *cloudhub.Config) error {
	c.Config = config
	return nil
}

// All ...
func (c ConfigStore) All(ctx context.Context) ([]cloudhub.Config, error) {
	return c.All(ctx)
}