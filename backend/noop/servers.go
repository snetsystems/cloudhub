package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure ServersStore implements cloudhub.ServersStore
var _ cloudhub.ServersStore = &ServersStore{}

// ServersStore ...
type ServersStore struct{}

// All ...
func (s *ServersStore) All(context.Context) ([]cloudhub.Server, error) {
	return nil, fmt.Errorf("no servers found")
}

// Add ...
func (s *ServersStore) Add(context.Context, cloudhub.Server) (cloudhub.Server, error) {
	return cloudhub.Server{}, fmt.Errorf("failed to add server")
}

// Delete ...
func (s *ServersStore) Delete(context.Context, cloudhub.Server) error {
	return fmt.Errorf("failed to delete server")
}

// Get ...
func (s *ServersStore) Get(ctx context.Context, ID int) (cloudhub.Server, error) {
	return cloudhub.Server{}, cloudhub.ErrServerNotFound
}

// Update ...
func (s *ServersStore) Update(context.Context, cloudhub.Server) error {
	return fmt.Errorf("failed to update server")
}
