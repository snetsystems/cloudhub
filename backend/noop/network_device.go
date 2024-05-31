package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure DeviceStore implements cloudhub.DeviceStore
var _ cloudhub.NetworkDeviceStore = &NetworkDeviceStore{}

// NetworkDeviceStore ...
type NetworkDeviceStore struct{}

// All ...
func (s *NetworkDeviceStore) All(context.Context) ([]cloudhub.NetworkDevice, error) {
	return nil, fmt.Errorf("no Network Device found")
}

// Add ...
func (s *NetworkDeviceStore) Add(context.Context, *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {
	return nil, fmt.Errorf("failed to add Network Device")
}

// Delete ...
func (s *NetworkDeviceStore) Delete(context.Context, *cloudhub.NetworkDevice) error {
	return fmt.Errorf("failed to delete Network Device")
}

// Get ...
func (s *NetworkDeviceStore) Get(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
	return nil, cloudhub.ErrDeviceNotFound
}

// Update ...
func (s *NetworkDeviceStore) Update(context.Context, *cloudhub.NetworkDevice) error {
	return fmt.Errorf("failed to update Network Device")
}
