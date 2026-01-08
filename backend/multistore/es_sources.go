package multistore

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure EsSourcesStore implements cloudhub.EsSourcesStore.
var _ cloudhub.EsSourcesStore = &EsSourcesStore{}

// EsSourcesStore delegates to the SourcesStores that compose it
type EsSourcesStore struct {
	Stores []cloudhub.EsSourcesStore
}

// All concatenates the Sources of all contained Stores
func (multi *EsSourcesStore) All(ctx context.Context) ([]cloudhub.EsSource, error) {
	all := []cloudhub.EsSource{}
	sourceSet := map[int]struct{}{}

	ok := false
	var err error
	for _, store := range multi.Stores {
		var sources []cloudhub.EsSource
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
			if _, okay := sourceSet[s.ID]; !okay { // We have a new EsSource!
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
func (multi *EsSourcesStore) Add(ctx context.Context, src cloudhub.EsSource) (cloudhub.EsSource, error) {
	var err error
	for _, store := range multi.Stores {
		var s cloudhub.EsSource
		s, err = store.Add(ctx, src)
		if err == nil {
			return s, nil
		}
	}
	return cloudhub.EsSource{}, nil
}

// Delete delegates to all stores, returns success if one Store is successful
func (multi *EsSourcesStore) Delete(ctx context.Context, src cloudhub.EsSource) error {
	var err error
	for _, store := range multi.Stores {
		err = store.Delete(ctx, src)
		if err == nil {
			return nil
		}
	}
	return err
}

// Get finds the EsSource by id among all contained Stores
func (multi *EsSourcesStore) Get(ctx context.Context, id int) (cloudhub.EsSource, error) {
	var err error
	for _, store := range multi.Stores {
		var s cloudhub.EsSource
		s, err = store.Get(ctx, id)
		if err == nil {
			return s, nil
		}
	}
	return cloudhub.EsSource{}, err
}

// Update the first store to return a successful response
func (multi *EsSourcesStore) Update(ctx context.Context, src cloudhub.EsSource) error {
	var err error
	for _, store := range multi.Stores {
		err = store.Update(ctx, src)
		if err == nil {
			return nil
		}
	}
	return err
}
