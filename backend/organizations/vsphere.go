package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that VspheresStore implements cloudhub.VspheresStore
var _ cloudhub.VspheresStore = &VspheresStore{}

// VspheresStore facade on a VspheresStore that filters vspheres
// by organization.
type VspheresStore struct {
	store        cloudhub.VspheresStore
	organization string
}

// NewVspheresStore creates a new VspheresStore from an existing
// cloudhub.VspheresStore and an organization string
func NewVspheresStore(s cloudhub.VspheresStore, org string) *VspheresStore {
	return &VspheresStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all vspheres from the underlying VspheresStore and filters them
// by organization.
func (s *VspheresStore) All(ctx context.Context) ([]cloudhub.Vsphere, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	vs, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	vspheres := vs[:0]
	for _, d := range vs {
		if d.Organization == s.organization {
			vspheres = append(vspheres, d)
		}
	}

	return vspheres, nil
}

// Add creates a new Vsphere in the VspheresStore with vsphere.Organization set to be the
// organization from the vsphere store.
func (s *VspheresStore) Add(ctx context.Context, d cloudhub.Vsphere) (cloudhub.Vsphere, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.Vsphere{}, err
	}

	d.Organization = s.organization
	return s.store.Add(ctx, d)
}

// Delete the vsphere from VspheresStore
func (s *VspheresStore) Delete(ctx context.Context, d cloudhub.Vsphere) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	d, err = s.store.Get(ctx, d.ID)
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, d)
}

// Get returns a Vsphere if the id exists and belongs to the organization that is set.
func (s *VspheresStore) Get(ctx context.Context, id string) (cloudhub.Vsphere, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.Vsphere{}, err
	}

	d, err := s.store.Get(ctx, id)
	if err != nil {
		return cloudhub.Vsphere{}, err
	}

	if d.Organization != s.organization {
		return cloudhub.Vsphere{}, cloudhub.ErrVsphereNotFound
	}

	return d, nil
}

// Update the vsphere in VspheresStore.
func (s *VspheresStore) Update(ctx context.Context, d cloudhub.Vsphere) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, d.ID)
	if err != nil {
		return err
	}

	return s.store.Update(ctx, d)
}
