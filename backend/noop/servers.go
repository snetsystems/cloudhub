package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure ServersStore implements cmp.ServersStore
var _ cmp.ServersStore = &ServersStore{}

// ServersStore ...
type ServersStore struct{}

// All ...
func (s *ServersStore) All(context.Context) ([]cmp.Server, error) {
	return nil, fmt.Errorf("no servers found")
}

// Add ...
func (s *ServersStore) Add(context.Context, cmp.Server) (cmp.Server, error) {
	return cmp.Server{}, fmt.Errorf("failed to add server")
}

// Delete ...
func (s *ServersStore) Delete(context.Context, cmp.Server) error {
	return fmt.Errorf("failed to delete server")
}

// Get ...
func (s *ServersStore) Get(ctx context.Context, ID int) (cmp.Server, error) {
	return cmp.Server{}, cmp.ErrServerNotFound
}

// Update ...
func (s *ServersStore) Update(context.Context, cmp.Server) error {
	return fmt.Errorf("failed to update server")
}
