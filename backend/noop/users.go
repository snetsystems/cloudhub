package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure UsersStore implements cloudhub.UsersStore
var _ cloudhub.UsersStore = &UsersStore{}

// UsersStore ...
type UsersStore struct{}

// All ...
func (s *UsersStore) All(context.Context) ([]cloudhub.User, error) {
	return nil, fmt.Errorf("no users found")
}

// Add ...
func (s *UsersStore) Add(context.Context, *cloudhub.User) (*cloudhub.User, error) {
	return nil, fmt.Errorf("failed to add user")
}

// Delete ...
func (s *UsersStore) Delete(context.Context, *cloudhub.User) error {
	return fmt.Errorf("failed to delete user")
}

// Get ...
func (s *UsersStore) Get(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
	return nil, cloudhub.ErrUserNotFound
}

// Update ...
func (s *UsersStore) Update(context.Context, *cloudhub.User) error {
	return fmt.Errorf("failed to update user")
}

// Num ...
func (s *UsersStore) Num(context.Context) (int, error) {
	return 0, fmt.Errorf("failed to get number of users")
}
