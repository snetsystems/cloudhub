package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

// ConfigStore stores global application configuration
type ConfigStore struct {
	Config *cmp.Config
}

// Initialize is noop in mocks store
func (c ConfigStore) Initialize(ctx context.Context) error {
	return nil
}

// Get returns the whole global application configuration
func (c ConfigStore) Get(ctx context.Context) (*cmp.Config, error) {
	return c.Config, nil
}

// Update updates the whole global application configuration
func (c ConfigStore) Update(ctx context.Context, config *cmp.Config) error {
	c.Config = config
	return nil
}
