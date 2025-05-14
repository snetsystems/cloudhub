package memdb

import (
	"context"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure EsSourcesStore implements the interface
func TestEsSourcesStoreImplements(t *testing.T) {
	var _ cloudhub.EsSourcesStore = &EsSourcesStore{}
}

func TestEsSourcesStoreAdd(t *testing.T) {
	ctx := context.Background()
	store := EsSourcesStore{}
	_, err := store.Add(ctx, cloudhub.EsSource{})
	if err == nil {
		t.Fatal("Add should return an error: in-memory store does not support Add")
	}
}

func TestEsSourcesStoreAll(t *testing.T) {
	ctx := context.Background()
	store := EsSourcesStore{}

	srcs, err := store.All(ctx)
	if err != nil {
		t.Fatalf("All should not error on empty store: %v", err)
	}
	if len(srcs) != 0 {
		t.Fatalf("All on empty store should return empty slice, got %d", len(srcs))
	}

	// Populate one source
	store.EsSource = &cloudhub.EsSource{ID: 42, Name: "test"}
	srcs, err = store.All(ctx)
	if err != nil {
		t.Fatalf("All should not error when one source is set: %v", err)
	}
	if len(srcs) != 1 {
		t.Fatalf("All should return 1 element, got %d", len(srcs))
	}
	if srcs[0].ID != 42 {
		t.Fatalf("All returned wrong element ID: got %d, want 42", srcs[0].ID)
	}
}

func TestEsSourcesStoreGet(t *testing.T) {
	ctx := context.Background()
	store := EsSourcesStore{}

	// Empty store: should error
	if _, err := store.Get(ctx, 1); err == nil {
		t.Fatal("Get should error on empty store")
	}

	// Set a source and test mismatch
	store.EsSource = &cloudhub.EsSource{ID: 5}
	if _, err := store.Get(ctx, 6); err == nil {
		t.Fatal("Get should error for non-matching ID")
	}

	// Test matching ID
	src, err := store.Get(ctx, 5)
	if err != nil {
		t.Fatalf("Get should succeed for matching ID: %v", err)
	}
	if src.ID != 5 {
		t.Fatalf("Get returned wrong ID: got %d, want 5", src.ID)
	}
}

func TestEsSourcesStoreUpdate(t *testing.T) {
	ctx := context.Background()
	store := EsSourcesStore{}

	// Empty store: should error
	if err := store.Update(ctx, cloudhub.EsSource{ID: 1}); err == nil {
		t.Fatal("Update should error on empty store")
	}

	// Set a source and test mismatch
	store.EsSource = &cloudhub.EsSource{ID: 7, Name: "orig"}
	if err := store.Update(ctx, cloudhub.EsSource{ID: 8, Name: "new"}); err == nil {
		t.Fatal("Update should error for non-matching ID")
	}

	// Test matching ID update
	req := cloudhub.EsSource{ID: 7, Name: "updated", URL: "http://example"}
	if err := store.Update(ctx, req); err != nil {
		t.Fatalf("Update should succeed for matching ID: %v", err)
	}

	// Verify that store.EsSource was overwritten
	if store.EsSource == nil {
		t.Fatal("EsSource should not be nil after Update")
	}
	if !reflect.DeepEqual(*store.EsSource, req) {
		t.Fatalf("Update did not overwrite correctly: got %+v, want %+v", *store.EsSource, req)
	}
}

func TestEsSourcesStoreDelete(t *testing.T) {
	ctx := context.Background()
	store := EsSourcesStore{}

	// Empty store: should error
	if err := store.Delete(ctx, cloudhub.EsSource{ID: 1}); err == nil {
		t.Fatal("Delete should error on empty store")
	}

	// Set a source and test mismatch
	store.EsSource = &cloudhub.EsSource{ID: 9}
	if err := store.Delete(ctx, cloudhub.EsSource{ID: 8}); err == nil {
		t.Fatal("Delete should error for non-matching ID")
	}

	// Test matching ID delete
	if err := store.Delete(ctx, cloudhub.EsSource{ID: 9}); err != nil {
		t.Fatalf("Delete should succeed for matching ID: %v", err)
	}

	// Verify deletion
	if store.EsSource != nil {
		t.Fatal("EsSource should be nil after Delete")
	}
}
