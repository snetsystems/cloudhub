package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.OrganizationsStore = &OrganizationsStore{}

// OrganizationsStore ...
type OrganizationsStore struct {
	AllF                 func(context.Context) ([]cmp.Organization, error)
	AddF                 func(context.Context, *cmp.Organization) (*cmp.Organization, error)
	DeleteF              func(context.Context, *cmp.Organization) error
	GetF                 func(ctx context.Context, q cmp.OrganizationQuery) (*cmp.Organization, error)
	UpdateF              func(context.Context, *cmp.Organization) error
	CreateDefaultF       func(context.Context) error
	DefaultOrganizationF func(context.Context) (*cmp.Organization, error)
}

// CreateDefault ...
func (s *OrganizationsStore) CreateDefault(ctx context.Context) error {
	return s.CreateDefaultF(ctx)
}

// DefaultOrganization ...
func (s *OrganizationsStore) DefaultOrganization(ctx context.Context) (*cmp.Organization, error) {
	return s.DefaultOrganizationF(ctx)
}

// Add ...
func (s *OrganizationsStore) Add(ctx context.Context, o *cmp.Organization) (*cmp.Organization, error) {
	return s.AddF(ctx, o)
}

// All ...
func (s *OrganizationsStore) All(ctx context.Context) ([]cmp.Organization, error) {
	return s.AllF(ctx)
}

// Delete ...
func (s *OrganizationsStore) Delete(ctx context.Context, o *cmp.Organization) error {
	return s.DeleteF(ctx, o)
}

// Get ...
func (s *OrganizationsStore) Get(ctx context.Context, q cmp.OrganizationQuery) (*cmp.Organization, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *OrganizationsStore) Update(ctx context.Context, o *cmp.Organization) error {
	return s.UpdateF(ctx, o)
}
