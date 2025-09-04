package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that EsSourcesStore implements cloudhub.SourceStore
var _ cloudhub.EsSourcesStore = &EsSourcesStore{}

// EsSourcesStore facade on a SourceStore that filters sources
// by organization.
type EsSourcesStore struct {
	store        cloudhub.EsSourcesStore
	organization string
}

// NewEsSourcesStore creates a new EsSourcesStore from an existing
// cloudhub.SourceStore and an organization string
func NewEsSourcesStore(s cloudhub.EsSourcesStore, org string) *EsSourcesStore {
	return &EsSourcesStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all sources from the underlying SourceStore and filters them
// by organization.
func (s *EsSourcesStore) All(ctx context.Context) ([]cloudhub.EsSource, error) {
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

// Add creates a new EsSource in the EsSourcesStore with source.Organization set to be the
// organization from the source store.
func (s *EsSourcesStore) Add(ctx context.Context, d cloudhub.EsSource) (cloudhub.EsSource, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.EsSource{}, err
	}

	d.Organization = s.organization
	return s.store.Add(ctx, d)
}

// Delete the source from EsSourcesStore
func (s *EsSourcesStore) Delete(ctx context.Context, d cloudhub.EsSource) error {
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

// Get returns a EsSource if the id exists and belongs to the organization that is set.
func (s *EsSourcesStore) Get(ctx context.Context, id int) (cloudhub.EsSource, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.EsSource{}, err
	}

	d, err := s.store.Get(ctx, id)
	if err != nil {
		return cloudhub.EsSource{}, err
	}

	if d.Organization != s.organization {
		return cloudhub.EsSource{}, cloudhub.ErrSourceNotFound
	}

	return d, nil
}

// Update the source in EsSourcesStore.
func (s *EsSourcesStore) Update(ctx context.Context, d cloudhub.EsSource) error {
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
