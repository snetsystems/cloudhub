package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.VspheresStore = &VspheresStore{}

// VspheresStore mock allows all functions to be set for testing
type VspheresStore struct {
	AllF    func(context.Context) ([]cloudhub.Vsphere, error)
	AddF    func(context.Context, cloudhub.Vsphere) (cloudhub.Vsphere, error)
	DeleteF func(context.Context, cloudhub.Vsphere) error
	GetF    func(context.Context, string) (cloudhub.Vsphere, error)
	UpdateF func(context.Context, cloudhub.Vsphere) error
}

// All ...
func (s *VspheresStore) All(ctx context.Context) ([]cloudhub.Vsphere, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *VspheresStore) Add(ctx context.Context, vs cloudhub.Vsphere) (cloudhub.Vsphere, error) {
	return s.AddF(ctx, vs)
}

// Delete ...
func (s *VspheresStore) Delete(ctx context.Context, vs cloudhub.Vsphere) error {
	return s.DeleteF(ctx, vs)
}

// Get ...
func (s *VspheresStore) Get(ctx context.Context, id string) (cloudhub.Vsphere, error) {
	return s.GetF(ctx, id)
}

// Update ...
func (s *VspheresStore) Update(ctx context.Context, vs cloudhub.Vsphere) error {
	return s.UpdateF(ctx, vs)
}
