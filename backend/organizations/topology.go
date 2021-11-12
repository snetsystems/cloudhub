package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that TopologiesStore implements cloudhub.TopologiesStore
var _ cloudhub.TopologiesStore = &TopologiesStore{}

// TopologiesStore facade on a TopologiesStore that filters topologies
// by organization.
type TopologiesStore struct {
	store        cloudhub.TopologiesStore
	organization string
}

// NewTopologiesStore creates a new TopologiesStore from an existing
// cloudhub.TopologiesStore and an organization string
func NewTopologiesStore(s cloudhub.TopologiesStore, org string) *TopologiesStore {
	return &TopologiesStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all topologies from the underlying TopologiesStore and filters them
// by organization.
func (s *TopologiesStore) All(ctx context.Context) ([]cloudhub.Topology, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	tp, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	topologies := tp[:0]
	for _, d := range tp {
		if d.Organization == s.organization {
			topologies = append(topologies, d)
		}
	}

	return topologies, nil
}

// Get returns a Topology if the id exists and belongs to the organization that is set.
func (s *TopologiesStore) Get(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
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

// Add creates a new Topology in the TopologiesStore with topology.Organization set to be the
// organization from the topology store.
func (s *TopologiesStore) Add(ctx context.Context, t *cloudhub.Topology) (*cloudhub.Topology, error) {
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

// Delete the topology from TopologiesStore
func (s *TopologiesStore) Delete(ctx context.Context, t *cloudhub.Topology) error {
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

// Update the topology in TopologiesStore.
func (s *TopologiesStore) Update(ctx context.Context, t *cloudhub.Topology) error {
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
