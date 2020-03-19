package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OrganizationsStore = &OrganizationsStore{}

// OrganizationsStore ...
type OrganizationsStore struct {
	AllF                 func(context.Context) ([]cloudhub.Organization, error)
	AddF                 func(context.Context, *cloudhub.Organization) (*cloudhub.Organization, error)
	DeleteF              func(context.Context, *cloudhub.Organization) error
	GetF                 func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error)
	UpdateF              func(context.Context, *cloudhub.Organization) error
	CreateDefaultF       func(context.Context) error
	DefaultOrganizationF func(context.Context) (*cloudhub.Organization, error)
}

// CreateDefault ...
func (s *OrganizationsStore) CreateDefault(ctx context.Context) error {
	return s.CreateDefaultF(ctx)
}

// DefaultOrganization ...
func (s *OrganizationsStore) DefaultOrganization(ctx context.Context) (*cloudhub.Organization, error) {
	return s.DefaultOrganizationF(ctx)
}

// Add ...
func (s *OrganizationsStore) Add(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
	return s.AddF(ctx, o)
}

// All ...
func (s *OrganizationsStore) All(ctx context.Context) ([]cloudhub.Organization, error) {
	return s.AllF(ctx)
}

// Delete ...
func (s *OrganizationsStore) Delete(ctx context.Context, o *cloudhub.Organization) error {
	return s.DeleteF(ctx, o)
}

// Get ...
func (s *OrganizationsStore) Get(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *OrganizationsStore) Update(ctx context.Context, o *cloudhub.Organization) error {
	return s.UpdateF(ctx, o)
}
