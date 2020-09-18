package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure VspheresStore implements cloudhub.VspheresStore
var _ cloudhub.VspheresStore = &VspheresStore{}

// VspheresStore ...
type VspheresStore struct{}

// All ...
func (s *VspheresStore) All(context.Context) ([]cloudhub.Vsphere, error) {
	return nil, fmt.Errorf("no vspheres found")
}

// Add ...
func (s *VspheresStore) Add(context.Context, cloudhub.Vsphere) (cloudhub.Vsphere, error) {
	return cloudhub.Vsphere{}, fmt.Errorf("failed to add vsphere")
}

// Delete ...
func (s *VspheresStore) Delete(context.Context, cloudhub.Vsphere) error {
	return fmt.Errorf("failed to delete vsphere")
}

// Get ...
func (s *VspheresStore) Get(context.Context, string) (cloudhub.Vsphere, error) {
	return cloudhub.Vsphere{}, cloudhub.ErrVsphereNotFound
}

// Update ...
func (s *VspheresStore) Update(context.Context, cloudhub.Vsphere) error {
	return fmt.Errorf("failed to update vsphere")
}
