package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.UsersStore = &UsersStore{}

// UsersStore mock allows all functions to be set for testing
type UsersStore struct {
	AllF    func(context.Context) ([]cloudhub.User, error)
	AddF    func(context.Context, *cloudhub.User) (*cloudhub.User, error)
	DeleteF func(context.Context, *cloudhub.User) error
	GetF    func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error)
	UpdateF func(context.Context, *cloudhub.User) error
	NumF    func(context.Context) (int, error)
}

// All lists all users from the UsersStore
func (s *UsersStore) All(ctx context.Context) ([]cloudhub.User, error) {
	return s.AllF(ctx)
}

// Num returns the number of users in the UsersStore
func (s *UsersStore) Num(ctx context.Context) (int, error) {
	return s.NumF(ctx)
}

// Add a new User in the UsersStore
func (s *UsersStore) Add(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
	return s.AddF(ctx, u)
}

// Delete the User from the UsersStore
func (s *UsersStore) Delete(ctx context.Context, u *cloudhub.User) error {
	return s.DeleteF(ctx, u)
}

// Get retrieves a user if name exists.
func (s *UsersStore) Get(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
	return s.GetF(ctx, q)
}

// Update the user's permissions or roles
func (s *UsersStore) Update(ctx context.Context, u *cloudhub.User) error {
	return s.UpdateF(ctx, u)
}
