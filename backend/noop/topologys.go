package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure TopologiesStore implements cloudhub.TopologiesStore
var _ cloudhub.TopologiesStore = &TopologiesStore{}

// TopologiesStore ...
type TopologiesStore struct{}

// All ...
func (s *TopologiesStore) All(context.Context) ([]cloudhub.Topology, error) {
	return nil, fmt.Errorf("no topologies found")
}

// Add ...
func (s *TopologiesStore) Add(context.Context, *cloudhub.Topology) (*cloudhub.Topology, error) {
	return nil, fmt.Errorf("failed to add topology")
}

// Delete ...
func (s *TopologiesStore) Delete(context.Context, *cloudhub.Topology) error {
	return fmt.Errorf("failed to delete topology")
}

// Get ...
func (s *TopologiesStore) Get(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
	return nil, cloudhub.ErrTopologyNotFound
}

// Update ...
func (s *TopologiesStore) Update(context.Context, *cloudhub.Topology) error {
	return fmt.Errorf("failed to update topology")
}
