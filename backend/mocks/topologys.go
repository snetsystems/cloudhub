package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.TopologiesStore = &TopologiesStore{}

// TopologiesStore mock allows all functions to be set for testing
type TopologiesStore struct {
	AllF    func(context.Context) ([]cloudhub.Topology, error)
	AddF    func(context.Context, *cloudhub.Topology) (*cloudhub.Topology, error)
	DeleteF func(context.Context, *cloudhub.Topology) error
	GetF    func(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error)
	UpdateF func(context.Context, *cloudhub.Topology) error
}

// All ...
func (s *TopologiesStore) All(ctx context.Context) ([]cloudhub.Topology, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *TopologiesStore) Add(ctx context.Context, tp *cloudhub.Topology) (*cloudhub.Topology, error) {
	return s.AddF(ctx, tp)
}

// Delete ...
func (s *TopologiesStore) Delete(ctx context.Context, tp *cloudhub.Topology) error {
	return s.DeleteF(ctx, tp)
}

// Get ...
func (s *TopologiesStore) Get(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *TopologiesStore) Update(ctx context.Context, tp *cloudhub.Topology) error {
	return s.UpdateF(ctx, tp)
}
