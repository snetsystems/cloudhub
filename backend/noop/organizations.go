package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure OrganizationsStore implements cmp.OrganizationsStore
var _ cmp.OrganizationsStore = &OrganizationsStore{}

// OrganizationsStore ...
type OrganizationsStore struct{}

// CreateDefault ...
func (s *OrganizationsStore) CreateDefault(context.Context) error {
	return fmt.Errorf("failed to add organization")
}

// DefaultOrganization ...
func (s *OrganizationsStore) DefaultOrganization(context.Context) (*cmp.Organization, error) {
	return nil, fmt.Errorf("failed to retrieve default organization")
}

// All ...
func (s *OrganizationsStore) All(context.Context) ([]cmp.Organization, error) {
	return nil, fmt.Errorf("no organizations found")
}

// Add ...
func (s *OrganizationsStore) Add(context.Context, *cmp.Organization) (*cmp.Organization, error) {
	return nil, fmt.Errorf("failed to add organization")
}

// Delete ...
func (s *OrganizationsStore) Delete(context.Context, *cmp.Organization) error {
	return fmt.Errorf("failed to delete organization")
}

// Get ...
func (s *OrganizationsStore) Get(ctx context.Context, q cmp.OrganizationQuery) (*cmp.Organization, error) {
	return nil, cmp.ErrOrganizationNotFound
}

// Update ...
func (s *OrganizationsStore) Update(context.Context, *cmp.Organization) error {
	return fmt.Errorf("failed to update organization")
}
