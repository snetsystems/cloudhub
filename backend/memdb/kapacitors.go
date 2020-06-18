// Package memdb provides a transient layer to store the InfluxDB and Kapacitor
// configured via flags at Cloudhub start.
// Caution should be taken when editing resources generated from cli flags,
// especially in a distributed environment as unexpected behavior may occur.
// Instead, it is suggested that cloudhub be restarted to pick up the new
// flag/evar changes.
package memdb

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure KapacitorStore implements cloudhub.ServersStore.
var _ cloudhub.ServersStore = &KapacitorStore{}

// KapacitorStore implements the cloudhub.ServersStore interface, and keeps
// an in-memory Kapacitor according to startup configuration
type KapacitorStore struct {
	Kapacitor *cloudhub.Server
}

// All will return a slice containing a configured source
func (store *KapacitorStore) All(ctx context.Context) ([]cloudhub.Server, error) {
	if store.Kapacitor != nil {
		return []cloudhub.Server{*store.Kapacitor}, nil
	}
	return nil, nil
}

// Add does not have any effect
func (store *KapacitorStore) Add(ctx context.Context, kap cloudhub.Server) (cloudhub.Server, error) {
	return cloudhub.Server{}, fmt.Errorf("In-memory KapacitorStore does not support adding a Kapacitor")
}

// Delete removes the in-memory configured Kapacitor if its ID matches what's provided
func (store *KapacitorStore) Delete(ctx context.Context, kap cloudhub.Server) error {
	if store.Kapacitor == nil || store.Kapacitor.ID != kap.ID {
		return fmt.Errorf("Unable to find Kapacitor with id %d", kap.ID)
	}
	store.Kapacitor = nil
	return nil
}

// Get returns the in-memory Kapacitor if its ID matches what's provided
func (store *KapacitorStore) Get(ctx context.Context, id int) (cloudhub.Server, error) {
	if store.Kapacitor == nil || store.Kapacitor.ID != id {
		return cloudhub.Server{}, fmt.Errorf("Unable to find Kapacitor with id %d", id)
	}
	return *store.Kapacitor, nil
}

// Update overwrites the in-memory configured Kapacitor if its ID matches what's provided
func (store *KapacitorStore) Update(ctx context.Context, kap cloudhub.Server) error {
	if store.Kapacitor == nil || store.Kapacitor.ID != kap.ID {
		return fmt.Errorf("Unable to find Kapacitor with id %d", kap.ID)
	}
	store.Kapacitor = &kap
	return nil
}
