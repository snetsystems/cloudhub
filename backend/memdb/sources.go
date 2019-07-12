package memdb

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// Ensure SourcesStore implements cmp.SourcesStore.
var _ cmp.SourcesStore = &SourcesStore{}

// SourcesStore implements the cmp.SourcesStore interface
type SourcesStore struct {
	Source *cmp.Source
}

// Add does not have any effect
func (store *SourcesStore) Add(ctx context.Context, src cmp.Source) (cmp.Source, error) {
	return cmp.Source{}, fmt.Errorf("In-memory SourcesStore does not support adding a Source")
}

// All will return a slice containing a configured source
func (store *SourcesStore) All(ctx context.Context) ([]cmp.Source, error) {
	if store.Source != nil {
		return []cmp.Source{*store.Source}, nil
	}
	return nil, nil
}

// Delete removes the SourcesStore.Soruce if it matches the provided Source
func (store *SourcesStore) Delete(ctx context.Context, src cmp.Source) error {
	if store.Source == nil || store.Source.ID != src.ID {
		return fmt.Errorf("Unable to find Source with id %d", src.ID)
	}
	store.Source = nil
	return nil
}

// Get returns the configured source if the id matches
func (store *SourcesStore) Get(ctx context.Context, id int) (cmp.Source, error) {
	if store.Source == nil || store.Source.ID != id {
		return cmp.Source{}, fmt.Errorf("Unable to find Source with id %d", id)
	}
	return *store.Source, nil
}

// Update does nothing
func (store *SourcesStore) Update(ctx context.Context, src cmp.Source) error {
	if store.Source == nil || store.Source.ID != src.ID {
		return fmt.Errorf("Unable to find Source with id %d", src.ID)
	}
	store.Source = &src
	return nil
}
