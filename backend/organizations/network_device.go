package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that NetworkDeviceStore implements cloudhub.NetworkDeviceStore
var _ cloudhub.NetworkDeviceStore = &NetworkDeviceStore{}

// NetworkDeviceStore facade on a NetworkDeviceStore that filters Device
// by organization.
type NetworkDeviceStore struct {
	store        cloudhub.NetworkDeviceStore
	organization string
}

// NewNetworkDeviceStore creates a new NetworkDeviceStore from an existing
// cloudhub.NewNetworkDeviceStore and an organization string
func NewNetworkDeviceStore(s cloudhub.NetworkDeviceStore, org string) *NetworkDeviceStore {
	return &NetworkDeviceStore{
		store:        s,
		organization: org,
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

	devices := allDevice[:0]
	for _, d := range allDevice {
		if d.Organization == s.organization {
			devices = append(devices, d)
		}
	}

	return devices, nil
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

	t.Organization = s.organization

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
