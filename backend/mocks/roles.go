package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.RolesStore = &RolesStore{}

// RolesStore mock allows all functions to be set for testing
type RolesStore struct {
	AllF    func(context.Context) ([]cmp.Role, error)
	AddF    func(context.Context, *cmp.Role) (*cmp.Role, error)
	DeleteF func(context.Context, *cmp.Role) error
	GetF    func(ctx context.Context, name string) (*cmp.Role, error)
	UpdateF func(context.Context, *cmp.Role) error
}

// All lists all Roles from the RolesStore
func (s *RolesStore) All(ctx context.Context) ([]cmp.Role, error) {
	return s.AllF(ctx)
}

// Add a new Role in the RolesStore
func (s *RolesStore) Add(ctx context.Context, u *cmp.Role) (*cmp.Role, error) {
	return s.AddF(ctx, u)
}

// Delete the Role from the RolesStore
func (s *RolesStore) Delete(ctx context.Context, u *cmp.Role) error {
	return s.DeleteF(ctx, u)
}

// Get retrieves a Role if name exists.
func (s *RolesStore) Get(ctx context.Context, name string) (*cmp.Role, error) {
	return s.GetF(ctx, name)
}

// Update the Role's permissions or users
func (s *RolesStore) Update(ctx context.Context, u *cmp.Role) error {
	return s.UpdateF(ctx, u)
}
