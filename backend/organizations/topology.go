package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that TopologysStore implements cloudhub.TopologysStore
var _ cloudhub.TopologysStore = &TopologysStore{}

// TopologysStore facade on a TopologysStore that filters topologys
// by organization.
type TopologysStore struct {
	store        cloudhub.TopologysStore
	organization string
}

// NewTopologysStore creates a new TopologysStore from an existing
// cloudhub.TopologysStore and an organization string
func NewTopologysStore(s cloudhub.TopologysStore, org string) *TopologysStore {
	return &TopologysStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all topologys from the underlying TopologysStore and filters them
// by organization.
func (s *TopologysStore) All(ctx context.Context) ([]cloudhub.Topology, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	tp, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	topologys := tp[:0]
	for _, d := range tp {
		if d.Organization == s.organization {
			topologys = append(topologys, d)
		}
	}

	return topologys, nil
}

// Get returns a Topology if the id exists and belongs to the organization that is set.
func (s *TopologysStore) Get(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	q.Organization = &s.organization

	t, err := s.store.Get(ctx, q)
	if err != nil {
		return nil, err
	}

	if t.Organization != s.organization {
		return nil, cloudhub.ErrTopologyNotFound
	}

	return t, nil
}

// Add creates a new Topology in the TopologysStore with topology.Organization set to be the
// organization from the topology store.
func (s *TopologysStore) Add(ctx context.Context, t *cloudhub.Topology) (*cloudhub.Topology, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	t.Organization = s.organization

	// validate that the topology exists
	_, err = s.store.Get(ctx, cloudhub.TopologyQuery{Organization: &t.Organization})
	if err == nil {
		return nil, cloudhub.ErrTopologyAlreadyExists
	}

	return s.store.Add(ctx, t)
}

// Delete the topology from TopologysStore
func (s *TopologysStore) Delete(ctx context.Context, t *cloudhub.Topology) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.TopologyQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, t)
}

// Update the topology in TopologysStore.
func (s *TopologysStore) Update(ctx context.Context, t *cloudhub.Topology) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.TopologyQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Update(ctx, t)
}
