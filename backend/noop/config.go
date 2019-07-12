package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure ConfigStore implements cmp.ConfigStore
var _ cmp.ConfigStore = &ConfigStore{}

// ConfigStore ...
type ConfigStore struct{}

// Initialize : TODO(desa): this really should be removed
func (s *ConfigStore) Initialize(context.Context) error {
	return fmt.Errorf("cannot initialize")
}

// Get ...
func (s *ConfigStore) Get(context.Context) (*cmp.Config, error) {
	return nil, cmp.ErrConfigNotFound
}

// Update ...
func (s *ConfigStore) Update(context.Context, *cmp.Config) error {
	return fmt.Errorf("cannot update conifg")
}
