package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure Network Device Group Store implements cloudhub.NetworkDeviceOrgStore
var _ cloudhub.NetworkDeviceOrgStore = &NetworkDeviceOrgStore{}

// NetworkDeviceOrgStore ...
type NetworkDeviceOrgStore struct{}

// All ...
func (s *NetworkDeviceOrgStore) All(context.Context, cloudhub.NetworkDeviceOrgQuery) ([]cloudhub.NetworkDeviceOrg, error) {
	return nil, fmt.Errorf("no Network Device found")
}

// Add ...
func (s *NetworkDeviceOrgStore) Add(context.Context, *cloudhub.NetworkDeviceOrg, cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	return nil, fmt.Errorf("failed to add Network Device")
}

// Delete ...
func (s *NetworkDeviceOrgStore) Delete(context.Context, *cloudhub.NetworkDeviceOrg, cloudhub.NetworkDeviceOrgQuery) error {
	return fmt.Errorf("failed to delete Network Device")
}

// Get ...
func (s *NetworkDeviceOrgStore) Get(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	return nil, cloudhub.ErrDeviceNotFound
}

// Update ...
func (s *NetworkDeviceOrgStore) Update(context.Context, *cloudhub.NetworkDeviceOrg, cloudhub.NetworkDeviceOrgQuery) error {
	return fmt.Errorf("failed to update Network Device")
}
