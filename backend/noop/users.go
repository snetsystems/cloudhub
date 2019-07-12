package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure UsersStore implements cmp.UsersStore
var _ cmp.UsersStore = &UsersStore{}

// UsersStore ...
type UsersStore struct{}

// All ...
func (s *UsersStore) All(context.Context) ([]cmp.User, error) {
	return nil, fmt.Errorf("no users found")
}

// Add ...
func (s *UsersStore) Add(context.Context, *cmp.User) (*cmp.User, error) {
	return nil, fmt.Errorf("failed to add user")
}

// Delete ...
func (s *UsersStore) Delete(context.Context, *cmp.User) error {
	return fmt.Errorf("failed to delete user")
}

// Get ...
func (s *UsersStore) Get(ctx context.Context, q cmp.UserQuery) (*cmp.User, error) {
	return nil, cmp.ErrUserNotFound
}

// Update ...
func (s *UsersStore) Update(context.Context, *cmp.User) error {
	return fmt.Errorf("failed to update user")
}

// Num ...
func (s *UsersStore) Num(context.Context) (int, error) {
	return 0, fmt.Errorf("failed to get number of users")
}
