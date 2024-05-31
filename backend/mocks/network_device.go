package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.NetworkDeviceStore = &NetworkDeviceStore{}

// NetworkDeviceStore mock allows all functions to be set for testing
type NetworkDeviceStore struct {
	AllF    func(context.Context) ([]cloudhub.NetworkDevice, error)
	AddF    func(context.Context, *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error)
	DeleteF func(context.Context, *cloudhub.NetworkDevice) error
	GetF    func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error)
	UpdateF func(context.Context, *cloudhub.NetworkDevice) error
}

// All ...
func (s *NetworkDeviceStore) All(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *NetworkDeviceStore) Add(ctx context.Context, Device *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {
	return s.AddF(ctx, Device)
}

// Delete ...
func (s *NetworkDeviceStore) Delete(ctx context.Context, Device *cloudhub.NetworkDevice) error {
	return s.DeleteF(ctx, Device)
}

// Get ...
func (s *NetworkDeviceStore) Get(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *NetworkDeviceStore) Update(ctx context.Context, Device *cloudhub.NetworkDevice) error {
	return s.UpdateF(ctx, Device)
}
