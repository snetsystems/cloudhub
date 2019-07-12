package multistore

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

// Ensure KapacitorStore implements cmp.ServersStore.
var _ cmp.ServersStore = &KapacitorStore{}

// KapacitorStore implements the cmp.ServersStore interface, and
// delegates to all contained KapacitorStores
type KapacitorStore struct {
	Stores []cmp.ServersStore
}

// All concatenates the Kapacitors of all contained Stores
func (multi *KapacitorStore) All(ctx context.Context) ([]cmp.Server, error) {
	all := []cmp.Server{}
	kapSet := map[int]struct{}{}

	ok := false
	var err error
	for _, store := range multi.Stores {
		var kaps []cmp.Server
		kaps, err = store.All(ctx)
		if err != nil {
			// If this Store is unable to return an array of kapacitors, skip to the
			// next Store.
			continue
		}
		ok = true // We've received a response from at least one Store
		for _, kap := range kaps {
			// Enforce that the kapacitor has a unique ID
			// If the ID has been seen before, ignore the kapacitor
			if _, okay := kapSet[kap.ID]; !okay { // We have a new kapacitor
				kapSet[kap.ID] = struct{}{} // We just care that the ID is unique
				all = append(all, kap)
			}
		}
	}
	if !ok {
		return nil, err
	}
	return all, nil
}

// Add the kap to the first responsive Store
func (multi *KapacitorStore) Add(ctx context.Context, kap cmp.Server) (cmp.Server, error) {
	var err error
	for _, store := range multi.Stores {
		var k cmp.Server
		k, err = store.Add(ctx, kap)
		if err == nil {
			return k, nil
		}
	}
	return cmp.Server{}, nil
}

// Delete delegates to all Stores, returns success if one Store is successful
func (multi *KapacitorStore) Delete(ctx context.Context, kap cmp.Server) error {
	var err error
	for _, store := range multi.Stores {
		err = store.Delete(ctx, kap)
		if err == nil {
			return nil
		}
	}
	return err
}

// Get finds the Source by id among all contained Stores
func (multi *KapacitorStore) Get(ctx context.Context, id int) (cmp.Server, error) {
	var err error
	for _, store := range multi.Stores {
		var k cmp.Server
		k, err = store.Get(ctx, id)
		if err == nil {
			return k, nil
		}
	}
	return cmp.Server{}, nil
}

// Update the first responsive Store
func (multi *KapacitorStore) Update(ctx context.Context, kap cmp.Server) error {
	var err error
	for _, store := range multi.Stores {
		err = store.Update(ctx, kap)
		if err == nil {
			return nil
		}
	}
	return err
}
