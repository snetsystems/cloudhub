package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.NetworkDeviceOrgStore = &NetworkDeviceOrgStore{}

// NetworkDeviceOrgStore mock allows all functions to be set for testing
type NetworkDeviceOrgStore struct {
	AllF    func(context.Context) ([]cloudhub.NetworkDeviceOrg, error)
	AddF    func(context.Context, *cloudhub.NetworkDeviceOrg) (*cloudhub.NetworkDeviceOrg, error)
	DeleteF func(context.Context, *cloudhub.NetworkDeviceOrg) error
	GetF    func(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error)
	UpdateF func(context.Context, *cloudhub.NetworkDeviceOrg) error
}

// All ...
func (s *NetworkDeviceOrgStore) All(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *NetworkDeviceOrgStore) Add(ctx context.Context, DeviceOrg *cloudhub.NetworkDeviceOrg) (*cloudhub.NetworkDeviceOrg, error) {
	return s.AddF(ctx, DeviceOrg)
}

// Delete ...
func (s *NetworkDeviceOrgStore) Delete(ctx context.Context, DeviceOrg *cloudhub.NetworkDeviceOrg) error {
	return s.DeleteF(ctx, DeviceOrg)
}

// Get ...
func (s *NetworkDeviceOrgStore) Get(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *NetworkDeviceOrgStore) Update(ctx context.Context, DeviceOrg *cloudhub.NetworkDeviceOrg) error {
	return s.UpdateF(ctx, DeviceOrg)
}
