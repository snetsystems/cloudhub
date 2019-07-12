package memdb

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// Ensure KapacitorStore implements cmp.ServersStore.
var _ cmp.ServersStore = &KapacitorStore{}

// KapacitorStore implements the cmp.ServersStore interface, and keeps
// an in-memory Kapacitor according to startup configuration
type KapacitorStore struct {
	Kapacitor *cmp.Server
}

// All will return a slice containing a configured source
func (store *KapacitorStore) All(ctx context.Context) ([]cmp.Server, error) {
	if store.Kapacitor != nil {
		return []cmp.Server{*store.Kapacitor}, nil
	}
	return nil, nil
}

// Add does not have any effect
func (store *KapacitorStore) Add(ctx context.Context, kap cmp.Server) (cmp.Server, error) {
	return cmp.Server{}, fmt.Errorf("In-memory KapacitorStore does not support adding a Kapacitor")
}

// Delete removes the in-memory configured Kapacitor if its ID matches what's provided
func (store *KapacitorStore) Delete(ctx context.Context, kap cmp.Server) error {
	if store.Kapacitor == nil || store.Kapacitor.ID != kap.ID {
		return fmt.Errorf("Unable to find Kapacitor with id %d", kap.ID)
	}
	store.Kapacitor = nil
	return nil
}

// Get returns the in-memory Kapacitor if its ID matches what's provided
func (store *KapacitorStore) Get(ctx context.Context, id int) (cmp.Server, error) {
	if store.Kapacitor == nil || store.Kapacitor.ID != id {
		return cmp.Server{}, fmt.Errorf("Unable to find Kapacitor with id %d", id)
	}
	return *store.Kapacitor, nil
}

// Update overwrites the in-memory configured Kapacitor if its ID matches what's provided
func (store *KapacitorStore) Update(ctx context.Context, kap cmp.Server) error {
	if store.Kapacitor == nil || store.Kapacitor.ID != kap.ID {
		return fmt.Errorf("Unable to find Kapacitor with id %d", kap.ID)
	}
	store.Kapacitor = &kap
	return nil
}
