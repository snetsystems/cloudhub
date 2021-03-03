package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.TopologysStore = &TopologysStore{}

// TopologysStore mock allows all functions to be set for testing
type TopologysStore struct {
	AllF    func(context.Context) ([]cloudhub.Topology, error)
	AddF    func(context.Context, *cloudhub.Topology) (*cloudhub.Topology, error)
	DeleteF func(context.Context, *cloudhub.Topology) error
	GetF    func(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error)
	UpdateF func(context.Context, *cloudhub.Topology) error
}

// All ...
func (s *TopologysStore) All(ctx context.Context) ([]cloudhub.Topology, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *TopologysStore) Add(ctx context.Context, tp *cloudhub.Topology) (*cloudhub.Topology, error) {
	return s.AddF(ctx, tp)
}

// Delete ...
func (s *TopologysStore) Delete(ctx context.Context, tp *cloudhub.Topology) error {
	return s.DeleteF(ctx, tp)
}

// Get ...
func (s *TopologysStore) Get(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *TopologysStore) Update(ctx context.Context, tp *cloudhub.Topology) error {
	return s.UpdateF(ctx, tp)
}
