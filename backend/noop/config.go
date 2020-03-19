package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure ConfigStore implements cloudhub.ConfigStore
var _ cloudhub.ConfigStore = &ConfigStore{}

// ConfigStore ...
type ConfigStore struct{}

// Initialize : TODO(desa): this really should be removed
func (s *ConfigStore) Initialize(context.Context) error {
	return fmt.Errorf("cannot initialize")
}

// Get ...
func (s *ConfigStore) Get(context.Context) (*cloudhub.Config, error) {
	return nil, cloudhub.ErrConfigNotFound
}

// Update ...
func (s *ConfigStore) Update(context.Context, *cloudhub.Config) error {
	return fmt.Errorf("cannot update conifg")
}
