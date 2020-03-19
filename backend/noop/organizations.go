package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure OrganizationsStore implements cloudhub.OrganizationsStore
var _ cloudhub.OrganizationsStore = &OrganizationsStore{}

// OrganizationsStore ...
type OrganizationsStore struct{}

// CreateDefault ...
func (s *OrganizationsStore) CreateDefault(context.Context) error {
	return fmt.Errorf("failed to add organization")
}

// DefaultOrganization ...
func (s *OrganizationsStore) DefaultOrganization(context.Context) (*cloudhub.Organization, error) {
	return nil, fmt.Errorf("failed to retrieve default organization")
}

// All ...
func (s *OrganizationsStore) All(context.Context) ([]cloudhub.Organization, error) {
	return nil, fmt.Errorf("no organizations found")
}

// Add ...
func (s *OrganizationsStore) Add(context.Context, *cloudhub.Organization) (*cloudhub.Organization, error) {
	return nil, fmt.Errorf("failed to add organization")
}

// Delete ...
func (s *OrganizationsStore) Delete(context.Context, *cloudhub.Organization) error {
	return fmt.Errorf("failed to delete organization")
}

// Get ...
func (s *OrganizationsStore) Get(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
	return nil, cloudhub.ErrOrganizationNotFound
}

// Update ...
func (s *OrganizationsStore) Update(context.Context, *cloudhub.Organization) error {
	return fmt.Errorf("failed to update organization")
}
