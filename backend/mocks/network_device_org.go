package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.NetworkDeviceOrgStore = &NetworkDeviceOrgStore{}

// NetworkDeviceOrgStore mock allows all functions to be set for testing
type NetworkDeviceOrgStore struct {
	AllF    func(context.Context, cloudhub.NetworkDeviceOrgQuery) ([]cloudhub.NetworkDeviceOrg, error)
	AddF    func(context.Context, *cloudhub.NetworkDeviceOrg, cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error)
	DeleteF func(context.Context, *cloudhub.NetworkDeviceOrg, cloudhub.NetworkDeviceOrgQuery) error
	GetF    func(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error)
	UpdateF func(context.Context, *cloudhub.NetworkDeviceOrg, cloudhub.NetworkDeviceOrgQuery) error
}

// All ...
func (s *NetworkDeviceOrgStore) All(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) ([]cloudhub.NetworkDeviceOrg, error) {
	return s.AllF(ctx, q)
}

// Add ...
func (s *NetworkDeviceOrgStore) Add(ctx context.Context, DeviceOrg *cloudhub.NetworkDeviceOrg, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	return s.AddF(ctx, DeviceOrg, q)
}

// Delete ...
func (s *NetworkDeviceOrgStore) Delete(ctx context.Context, DeviceOrg *cloudhub.NetworkDeviceOrg, q cloudhub.NetworkDeviceOrgQuery) error {
	return s.DeleteF(ctx, DeviceOrg, q)
}

// Get ...
func (s *NetworkDeviceOrgStore) Get(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *NetworkDeviceOrgStore) Update(ctx context.Context, DeviceOrg *cloudhub.NetworkDeviceOrg, q cloudhub.NetworkDeviceOrgQuery) error {
	return s.UpdateF(ctx, DeviceOrg, q)
}
