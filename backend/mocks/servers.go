package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.ServersStore = &ServersStore{}

// ServersStore mock allows all functions to be set for testing
type ServersStore struct {
	AllF    func(context.Context) ([]cmp.Server, error)
	AddF    func(context.Context, cmp.Server) (cmp.Server, error)
	DeleteF func(context.Context, cmp.Server) error
	GetF    func(ctx context.Context, ID int) (cmp.Server, error)
	UpdateF func(context.Context, cmp.Server) error
}

// All ...
func (s *ServersStore) All(ctx context.Context) ([]cmp.Server, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *ServersStore) Add(ctx context.Context, srv cmp.Server) (cmp.Server, error) {
	return s.AddF(ctx, srv)
}

// Delete ...
func (s *ServersStore) Delete(ctx context.Context, srv cmp.Server) error {
	return s.DeleteF(ctx, srv)
}

// Get ...
func (s *ServersStore) Get(ctx context.Context, id int) (cmp.Server, error) {
	return s.GetF(ctx, id)
}

// Update ...
func (s *ServersStore) Update(ctx context.Context, srv cmp.Server) error {
	return s.UpdateF(ctx, srv)
}
