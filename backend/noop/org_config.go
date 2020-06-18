package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure OrganizationConfigStore implements cloudhub.OrganizationConfigStore
var _ cloudhub.OrganizationConfigStore = &OrganizationConfigStore{}

// OrganizationConfigStore ...
type OrganizationConfigStore struct{}

// FindOrCreate ...
func (s *OrganizationConfigStore) FindOrCreate(context.Context, string) (*cloudhub.OrganizationConfig, error) {
	return nil, cloudhub.ErrOrganizationConfigNotFound
}

// Put ...
func (s *OrganizationConfigStore) Put(context.Context, *cloudhub.OrganizationConfig) error {
	return fmt.Errorf("cannot replace config")
}

// All ...
func (s *OrganizationConfigStore) All(context.Context) ([]cloudhub.OrganizationConfig, error) {
	return nil, fmt.Errorf("no organizationConfigs found")
}
