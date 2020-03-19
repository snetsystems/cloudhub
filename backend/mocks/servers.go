package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.ServersStore = &ServersStore{}

// ServersStore mock allows all functions to be set for testing
type ServersStore struct {
	AllF    func(context.Context) ([]cloudhub.Server, error)
	AddF    func(context.Context, cloudhub.Server) (cloudhub.Server, error)
	DeleteF func(context.Context, cloudhub.Server) error
	GetF    func(ctx context.Context, ID int) (cloudhub.Server, error)
	UpdateF func(context.Context, cloudhub.Server) error
}

// All ...
func (s *ServersStore) All(ctx context.Context) ([]cloudhub.Server, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *ServersStore) Add(ctx context.Context, srv cloudhub.Server) (cloudhub.Server, error) {
	return s.AddF(ctx, srv)
}

// Delete ...
func (s *ServersStore) Delete(ctx context.Context, srv cloudhub.Server) error {
	return s.DeleteF(ctx, srv)
}

// Get ...
func (s *ServersStore) Get(ctx context.Context, id int) (cloudhub.Server, error) {
	return s.GetF(ctx, id)
}

// Update ...
func (s *ServersStore) Update(ctx context.Context, srv cloudhub.Server) error {
	return s.UpdateF(ctx, srv)
}
