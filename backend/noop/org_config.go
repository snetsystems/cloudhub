package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure OrganizationConfigStore implements cmp.OrganizationConfigStore
var _ cmp.OrganizationConfigStore = &OrganizationConfigStore{}

// OrganizationConfigStore ...
type OrganizationConfigStore struct{}

// FindOrCreate ...
func (s *OrganizationConfigStore) FindOrCreate(context.Context, string) (*cmp.OrganizationConfig, error) {
	return nil, cmp.ErrOrganizationConfigNotFound
}

// Put ...
func (s *OrganizationConfigStore) Put(context.Context, *cmp.OrganizationConfig) error {
	return fmt.Errorf("cannot replace config")
}
