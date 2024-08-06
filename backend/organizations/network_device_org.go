package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that NetworkDeviceOrgStore implements cloudhub.NetworkDeviceOrgStore
var _ cloudhub.NetworkDeviceOrgStore = &NetworkDeviceOrgStore{}

// NetworkDeviceOrgStore facade on a NetworkDeviceOrgStore that filters Device
// by organization.
type NetworkDeviceOrgStore struct {
	store        cloudhub.NetworkDeviceOrgStore
	organization string
	isSuperAdmin bool
}

// NewNetworkDeviceOrgStore creates a new NewNetworkDeviceOrgStore from an existing
// cloudhub.NewNetworkDeviceOrgStore and an organization string
func NewNetworkDeviceOrgStore(s cloudhub.NetworkDeviceOrgStore, org string, isSuperAdmin bool) *NetworkDeviceOrgStore {
	return &NetworkDeviceOrgStore{
		store:        s,
		organization: org,
		isSuperAdmin: isSuperAdmin,
	}
}

// All retrieves all org from the underlying NetworkDeviceOrgStore and filters them
// by organization.
func (s *NetworkDeviceOrgStore) All(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	orgs, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}
	return orgs, nil
}

// Get returns a Device if the id exists and belongs to the organization that is set.
func (s *NetworkDeviceOrgStore) Get(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}
	t, err := s.store.Get(ctx, q)
	if err != nil {
		return nil, err
	}
	if s.isSuperAdmin {
		return t, nil
	}

	if *q.ID != s.organization {
		return nil, cloudhub.ErrDeviceOrgNotFound
	}

	return t, nil
}

// Add creates a new Device in the NetworkDeviceOrgStore with NetworkDeviceOrg.Organization set to be the
// organization from the Device store.
func (s *NetworkDeviceOrgStore) Add(ctx context.Context, t *cloudhub.NetworkDeviceOrg) (*cloudhub.NetworkDeviceOrg, error) {

	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	return s.store.Add(ctx, t)
}

// Delete the Device from NetworkDeviceOrgStore
func (s *NetworkDeviceOrgStore) Delete(ctx context.Context, t *cloudhub.NetworkDeviceOrg) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, t)
}

// Update the Device in NetworkDeviceOrgStore.
func (s *NetworkDeviceOrgStore) Update(ctx context.Context, t *cloudhub.NetworkDeviceOrg) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Update(ctx, t)
}
