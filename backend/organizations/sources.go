package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that SourcesStore implements cloudhub.SourceStore
var _ cloudhub.SourcesStore = &SourcesStore{}

// SourcesStore facade on a SourceStore that filters sources
// by organization.
type SourcesStore struct {
	store        cloudhub.SourcesStore
	organization string
}

// NewSourcesStore creates a new SourcesStore from an existing
// cloudhub.SourceStore and an organization string
func NewSourcesStore(s cloudhub.SourcesStore, org string) *SourcesStore {
	return &SourcesStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all sources from the underlying SourceStore and filters them
// by organization.
func (s *SourcesStore) All(ctx context.Context) ([]cloudhub.Source, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	ds, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	// This filters sources without allocating
	// https://github.com/golang/go/wiki/SliceTricks#filtering-without-allocating
	sources := ds[:0]
	for _, d := range ds {
		if d.Organization == s.organization {
			sources = append(sources, d)
		}
	}

	return sources, nil
}

// Add creates a new Source in the SourcesStore with source.Organization set to be the
// organization from the source store.
func (s *SourcesStore) Add(ctx context.Context, d cloudhub.Source) (cloudhub.Source, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.Source{}, err
	}

	d.Organization = s.organization
	return s.store.Add(ctx, d)
}

// Delete the source from SourcesStore
func (s *SourcesStore) Delete(ctx context.Context, d cloudhub.Source) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	d, err = s.store.Get(ctx, d.ID)
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, d)
}

// Get returns a Source if the id exists and belongs to the organization that is set.
func (s *SourcesStore) Get(ctx context.Context, id int) (cloudhub.Source, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.Source{}, err
	}

	d, err := s.store.Get(ctx, id)
	if err != nil {
		return cloudhub.Source{}, err
	}

	if d.Organization != s.organization {
		return cloudhub.Source{}, cloudhub.ErrSourceNotFound
	}

	return d, nil
}

// Update the source in SourcesStore.
func (s *SourcesStore) Update(ctx context.Context, d cloudhub.Source) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, d.ID)
	if err != nil {
		return err
	}

	return s.store.Update(ctx, d)
}
