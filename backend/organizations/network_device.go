package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that NetworkDeviceStore implements cloudhub.NetworkDeviceStore
var _ cloudhub.NetworkDeviceStore = &NetworkDeviceStore{}

const (
	// DefaultOrganizationID is the id of the default organization
	DefaultOrganizationID string = "default"
)

// NetworkDeviceStore facade on a NetworkDeviceStore that filters Device
// by organization.
type NetworkDeviceStore struct {
	store        cloudhub.NetworkDeviceStore
	organization string
	isSuperAdmin bool
}

// NewNetworkDeviceStore creates a new NetworkDeviceStore from an existing
// cloudhub.NewNetworkDeviceStore and an organization string
func NewNetworkDeviceStore(s cloudhub.NetworkDeviceStore, org string, isSuperAdmin bool) *NetworkDeviceStore {
	return &NetworkDeviceStore{
		store:        s,
		organization: org,
		isSuperAdmin: isSuperAdmin,
	}
}

// All retrieves all Devices from the underlying NetworkDeviceStore and filters them
// by organization.
func (s *NetworkDeviceStore) All(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	allDevice, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	return allDevice, nil
}

// Get returns a Device if the id exists and belongs to the organization that is set.
func (s *NetworkDeviceStore) Get(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	q.Organization = &s.organization

	t, err := s.store.Get(ctx, q)
	if err != nil {
		return nil, err
	}

	if s.isSuperAdmin {
		return t, nil
	}

	if t.Organization != s.organization {
		return nil, cloudhub.ErrDeviceNotFound
	}

	return t, nil
}

// Add creates a new Device in the NetworkDeviceStore with NetworkDevice.Organization set to be the
// organization from the Device store.
func (s *NetworkDeviceStore) Add(ctx context.Context, t *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {

	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	return s.store.Add(ctx, t)
}

// Delete the Device from NetworkDeviceStore
func (s *NetworkDeviceStore) Delete(ctx context.Context, t *cloudhub.NetworkDevice) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.NetworkDeviceQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, t)
}

// Update the Device in NetworkDeviceStore.
func (s *NetworkDeviceStore) Update(ctx context.Context, t *cloudhub.NetworkDevice) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.NetworkDeviceQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Update(ctx, t)
}
