package memdb

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure EsSourcesStore implements cloudhub.EsSourcesStore.
var _ cloudhub.EsSourcesStore = &EsSourcesStore{}

// EsSourcesStore implements the cloudhub.EsSourcesStore interface
type EsSourcesStore struct {
	EsSource *cloudhub.EsSource
}

// Add does not have any effect
func (store *EsSourcesStore) Add(ctx context.Context, src cloudhub.EsSource) (cloudhub.EsSource, error) {
	return cloudhub.EsSource{}, fmt.Errorf("In-memory EsSourcesStore does not support adding a EsSource")
}

// All will return a slice containing a configured source
func (store *EsSourcesStore) All(ctx context.Context) ([]cloudhub.EsSource, error) {
	if store.EsSource != nil {
		return []cloudhub.EsSource{*store.EsSource}, nil
	}
	return nil, nil
}

// Delete removes the EsSourcesStore.Soruce if it matches the provided EsSource
func (store *EsSourcesStore) Delete(ctx context.Context, src cloudhub.EsSource) error {
	if store.EsSource == nil || store.EsSource.ID != src.ID {
		return fmt.Errorf("Unable to find EsSource with id %d", src.ID)
	}
	store.EsSource = nil
	return nil
}

// Get returns the configured source if the id matches
func (store *EsSourcesStore) Get(ctx context.Context, id int) (cloudhub.EsSource, error) {
	if store.EsSource == nil || store.EsSource.ID != id {
		return cloudhub.EsSource{}, fmt.Errorf("Unable to find EsSource with id %d", id)
	}
	return *store.EsSource, nil
}

// Update does nothing
func (store *EsSourcesStore) Update(ctx context.Context, src cloudhub.EsSource) error {
	if store.EsSource == nil || store.EsSource.ID != src.ID {
		return fmt.Errorf("Unable to find EsSource with id %d", src.ID)
	}
	store.EsSource = &src
	return nil
}
