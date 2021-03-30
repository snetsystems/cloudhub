package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure TopologysStore implements cloudhub.TopologysStore
var _ cloudhub.TopologysStore = &TopologysStore{}

// TopologysStore ...
type TopologysStore struct{}

// All ...
func (s *TopologysStore) All(context.Context) ([]cloudhub.Topology, error) {
	return nil, fmt.Errorf("no topologies found")
}

// Add ...
func (s *TopologysStore) Add(context.Context, *cloudhub.Topology) (*cloudhub.Topology, error) {
	return nil, fmt.Errorf("failed to add topology")
}

// Delete ...
func (s *TopologysStore) Delete(context.Context, *cloudhub.Topology) error {
	return fmt.Errorf("failed to delete topology")
}

// Get ...
func (s *TopologysStore) Get(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
	return nil, cloudhub.ErrTopologyNotFound
}

// Update ...
func (s *TopologysStore) Update(context.Context, *cloudhub.Topology) error {
	return fmt.Errorf("failed to update topology")
}
