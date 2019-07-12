package organizations

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure that OrganizationConfig implements cmp.OrganizationConfigStore
var _ cmp.OrganizationConfigStore = &OrganizationConfigStore{}

// OrganizationConfigStore facade on a OrganizationConfig that filters OrganizationConfigs by organization.
type OrganizationConfigStore struct {
	store        cmp.OrganizationConfigStore
	organization string
}

// NewOrganizationConfigStore creates a new OrganizationConfigStore from an existing
// cmp.OrganizationConfigStore and an organization string
func NewOrganizationConfigStore(s cmp.OrganizationConfigStore, orgID string) *OrganizationConfigStore {
	return &OrganizationConfigStore{
		store:        s,
		organization: orgID,
	}
}

// FindOrCreate gets an organization's config or creates one if none exists
func (s *OrganizationConfigStore) FindOrCreate(ctx context.Context, orgID string) (*cmp.OrganizationConfig, error) {
	var err = validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	oc, err := s.store.FindOrCreate(ctx, orgID)
	if err != nil {
		return nil, err
	}

	return oc, nil

}

// Put the OrganizationConfig in OrganizationConfigStore.
func (s *OrganizationConfigStore) Put(ctx context.Context, c *cmp.OrganizationConfig) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	return s.store.Put(ctx, c)
}
