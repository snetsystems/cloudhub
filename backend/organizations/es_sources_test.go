package organizations_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// fakeStore implements cloudhub.EsSourcesStore for testing.
type fakeStore struct {
	AllF    func(ctx context.Context) ([]cloudhub.EsSource, error)
	AddF    func(ctx context.Context, src cloudhub.EsSource) (cloudhub.EsSource, error)
	GetF    func(ctx context.Context, id int) (cloudhub.EsSource, error)
	DeleteF func(ctx context.Context, src cloudhub.EsSource) error
	UpdateF func(ctx context.Context, src cloudhub.EsSource) error
}

func (m *fakeStore) All(ctx context.Context) ([]cloudhub.EsSource, error) {
	return m.AllF(ctx)
}
func (m *fakeStore) Add(ctx context.Context, src cloudhub.EsSource) (cloudhub.EsSource, error) {
	return m.AddF(ctx, src)
}
func (m *fakeStore) Get(ctx context.Context, id int) (cloudhub.EsSource, error) {
	return m.GetF(ctx, id)
}
func (m *fakeStore) Delete(ctx context.Context, src cloudhub.EsSource) error {
	return m.DeleteF(ctx, src)
}
func (m *fakeStore) Update(ctx context.Context, src cloudhub.EsSource) error {
	return m.UpdateF(ctx, src)
}

func TestEsSourcesStore_All(t *testing.T) {
	ctx := context.Background()
	// Case: underlying All fails
	store1 := &fakeStore{
		AllF: func(ctx context.Context) ([]cloudhub.EsSource, error) {
			return nil, errors.New("fail")
		},
	}
	esStore1 := organizations.NewEsSourcesStore(store1, "org1")
	esStore1Ctx := context.WithValue(ctx, organizations.ContextKey, "org1")
	_, err := esStore1.All(esStore1Ctx)
	if err == nil {
		t.Fatal("All should return error when underlying store fails")
	}

	// Case: filter by organization
	sources := []cloudhub.EsSource{
		{ID: 1, Organization: "org1"},
		{ID: 2, Organization: "org2"},
		{ID: 3, Organization: "org1"},
	}
	store2 := &fakeStore{AllF: func(ctx context.Context) ([]cloudhub.EsSource, error) {
		return sources, nil
	}}
	esStore2 := organizations.NewEsSourcesStore(store2, "org1")
	esStore2Ctx := context.WithValue(ctx, organizations.ContextKey, "org1")
	filtered, err := esStore2.All(esStore2Ctx)
	if err != nil {
		t.Fatalf("All unexpected error: %v", err)
	}
	want := []cloudhub.EsSource{{ID: 1, Organization: "org1"}, {ID: 3, Organization: "org1"}}
	if !reflect.DeepEqual(filtered, want) {
		t.Fatalf("All filtered mismatch: got %+v, want %+v", filtered, want)
	}
}

func TestEsSourcesStore_Add(t *testing.T) {
	ctx := context.Background()
	// underlying Add should receive Org set by wrapper
	called := false
	srcIn := cloudhub.EsSource{ID: 0, Name: "test"}
	store := &fakeStore{
		AddF: func(ctx context.Context, d cloudhub.EsSource) (cloudhub.EsSource, error) {
			called = true
			// Org must be overwritten
			if d.Organization != "orgA" {
				t.Fatalf("Add: Organization not set, got %q", d.Organization)
			}
			d.ID = 10
			return d, nil
		},
	}
	esStore := organizations.NewEsSourcesStore(store, "orgA")
	esCtx := context.WithValue(ctx, organizations.ContextKey, "orgA")
	r, err := esStore.Add(esCtx, srcIn)
	if err != nil {
		t.Fatalf("Add returned error: %v", err)
	}
	if !called {
		t.Fatal("AddF not called")
	}
	if r.ID != 10 || r.Organization != "orgA" {
		t.Fatalf("Add result mismatch: got %+v", r)
	}
}

func TestEsSourcesStore_Get(t *testing.T) {
	ctx := context.Background()
	// Case: underlying Get fails
	store1 := &fakeStore{GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
		return cloudhub.EsSource{}, errors.New("not found")
	}}
	es1 := organizations.NewEsSourcesStore(store1, "orgX")
	es1Ctx := context.WithValue(ctx, organizations.ContextKey, "orgX")
	_, err := es1.Get(es1Ctx, 5)
	if err == nil {
		t.Fatal("Get should error when underlying fails")
	}

	// Case: org mismatch
	store2 := &fakeStore{GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
		return cloudhub.EsSource{ID: id, Organization: "other"}, nil
	}}
	es2 := organizations.NewEsSourcesStore(store2, "orgY")
	es2Ctx := context.WithValue(ctx, organizations.ContextKey, "orgY")
	_, err = es2.Get(es2Ctx, 7)
	if err != cloudhub.ErrSourceNotFound {
		t.Fatalf("Get should return ErrSourceNotFound on Org mismatch, got %v", err)
	}

	// Case: success
	store3 := &fakeStore{GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
		return cloudhub.EsSource{ID: id, Organization: "orgZ"}, nil
	}}
	es3 := organizations.NewEsSourcesStore(store3, "orgZ")
	es3Ctx := context.WithValue(ctx, organizations.ContextKey, "orgZ")
	src, err := es3.Get(es3Ctx, 9)
	if err != nil || src.ID != 9 {
		t.Fatalf("Get expected success, got %v, %+v", err, src)
	}
}

func TestEsSourcesStore_Delete(t *testing.T) {
	ctx := context.Background()
	// underlying Get called then Delete
	calledGet := false
	calledDel := false
	store := &fakeStore{
		GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
			calledGet = true
			return cloudhub.EsSource{ID: id, Organization: "org1"}, nil
		},
		DeleteF: func(ctx context.Context, d cloudhub.EsSource) error {
			calledDel = true
			return nil
		},
	}
	esStore := organizations.NewEsSourcesStore(store, "org1")
	esCtx := context.WithValue(ctx, organizations.ContextKey, "org1")
	err := esStore.Delete(esCtx, cloudhub.EsSource{ID: 11})
	if err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if !calledGet || !calledDel {
		t.Fatal("Delete should call underlying Get and Delete")
	}
}

func TestEsSourcesStore_Update(t *testing.T) {
	ctx := context.Background()
	// underlying Get then Update
	calledGet := false
	calledUpd := false
	store := &fakeStore{
		GetF: func(ctx context.Context, id int) (cloudhub.EsSource, error) {
			calledGet = true
			return cloudhub.EsSource{ID: id, Organization: "orgA"}, nil
		},
		UpdateF: func(ctx context.Context, d cloudhub.EsSource) error {
			calledUpd = true
			return nil
		},
	}
	esStore := organizations.NewEsSourcesStore(store, "orgA")
	esCtx := context.WithValue(ctx, organizations.ContextKey, "orgA")
	err := esStore.Update(esCtx, cloudhub.EsSource{ID: 22})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if !calledGet || !calledUpd {
		t.Fatal("Update should call underlying Get and Update")
	}
}
