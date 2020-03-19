package multistore

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure SourcesStore implements cloudhub.SourcesStore.
var _ cloudhub.SourcesStore = &SourcesStore{}

// SourcesStore delegates to the SourcesStores that compose it
type SourcesStore struct {
	Stores []cloudhub.SourcesStore
}

// All concatenates the Sources of all contained Stores
func (multi *SourcesStore) All(ctx context.Context) ([]cloudhub.Source, error) {
	all := []cloudhub.Source{}
	sourceSet := map[int]struct{}{}

	ok := false
	var err error
	for _, store := range multi.Stores {
		var sources []cloudhub.Source
		sources, err = store.All(ctx)
		if err != nil {
			// If this Store is unable to return an array of sources, skip to the
			// next Store.
			continue
		}
		ok = true // We've received a response from at least one Store
		for _, s := range sources {
			// Enforce that the source has a unique ID
			// If the source has been seen before, don't override what we already have
			if _, okay := sourceSet[s.ID]; !okay { // We have a new Source!
				sourceSet[s.ID] = struct{}{} // We just care that the ID is unique
				all = append(all, s)
			}
		}
	}
	if !ok {
		return nil, err
	}
	return all, nil
}

// Add the src to the first Store to respond successfully
func (multi *SourcesStore) Add(ctx context.Context, src cloudhub.Source) (cloudhub.Source, error) {
	var err error
	for _, store := range multi.Stores {
		var s cloudhub.Source
		s, err = store.Add(ctx, src)
		if err == nil {
			return s, nil
		}
	}
	return cloudhub.Source{}, nil
}

// Delete delegates to all stores, returns success if one Store is successful
func (multi *SourcesStore) Delete(ctx context.Context, src cloudhub.Source) error {
	var err error
	for _, store := range multi.Stores {
		err = store.Delete(ctx, src)
		if err == nil {
			return nil
		}
	}
	return err
}

// Get finds the Source by id among all contained Stores
func (multi *SourcesStore) Get(ctx context.Context, id int) (cloudhub.Source, error) {
	var err error
	for _, store := range multi.Stores {
		var s cloudhub.Source
		s, err = store.Get(ctx, id)
		if err == nil {
			return s, nil
		}
	}
	return cloudhub.Source{}, err
}

// Update the first store to return a successful response
func (multi *SourcesStore) Update(ctx context.Context, src cloudhub.Source) error {
	var err error
	for _, store := range multi.Stores {
		err = store.Update(ctx, src)
		if err == nil {
			return nil
		}
	}
	return err
}
