package memdb

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure SourcesStore implements cloudhub.SourcesStore.
var _ cloudhub.SourcesStore = &SourcesStore{}

// SourcesStore implements the cloudhub.SourcesStore interface
type SourcesStore struct {
	Source *cloudhub.Source
}

// Add does not have any effect
func (store *SourcesStore) Add(ctx context.Context, src cloudhub.Source) (cloudhub.Source, error) {
	return cloudhub.Source{}, fmt.Errorf("In-memory SourcesStore does not support adding a Source")
}

// All will return a slice containing a configured source
func (store *SourcesStore) All(ctx context.Context) ([]cloudhub.Source, error) {
	if store.Source != nil {
		return []cloudhub.Source{*store.Source}, nil
	}
	return nil, nil
}

// Delete removes the SourcesStore.Soruce if it matches the provided Source
func (store *SourcesStore) Delete(ctx context.Context, src cloudhub.Source) error {
	if store.Source == nil || store.Source.ID != src.ID {
		return fmt.Errorf("Unable to find Source with id %d", src.ID)
	}
	store.Source = nil
	return nil
}

// Get returns the configured source if the id matches
func (store *SourcesStore) Get(ctx context.Context, id int) (cloudhub.Source, error) {
	if store.Source == nil || store.Source.ID != id {
		return cloudhub.Source{}, fmt.Errorf("Unable to find Source with id %d", id)
	}
	return *store.Source, nil
}

// Update does nothing
func (store *SourcesStore) Update(ctx context.Context, src cloudhub.Source) error {
	if store.Source == nil || store.Source.ID != src.ID {
		return fmt.Errorf("Unable to find Source with id %d", src.ID)
	}
	store.Source = &src
	return nil
}
