package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.SourcesStore = &SourcesStore{}

// SourcesStore mock allows all functions to be set for testing
type SourcesStore struct {
	AllF    func(context.Context) ([]cmp.Source, error)
	AddF    func(context.Context, cmp.Source) (cmp.Source, error)
	DeleteF func(context.Context, cmp.Source) error
	GetF    func(ctx context.Context, ID int) (cmp.Source, error)
	UpdateF func(context.Context, cmp.Source) error
}

// All returns all sources in the store
func (s *SourcesStore) All(ctx context.Context) ([]cmp.Source, error) {
	return s.AllF(ctx)
}

// Add creates a new source in the SourcesStore and returns Source with ID
func (s *SourcesStore) Add(ctx context.Context, src cmp.Source) (cmp.Source, error) {
	return s.AddF(ctx, src)
}

// Delete the Source from the store
func (s *SourcesStore) Delete(ctx context.Context, src cmp.Source) error {
	return s.DeleteF(ctx, src)
}

// Get retrieves Source if `ID` exists
func (s *SourcesStore) Get(ctx context.Context, ID int) (cmp.Source, error) {
	return s.GetF(ctx, ID)
}

// Update the Source in the store.
func (s *SourcesStore) Update(ctx context.Context, src cmp.Source) error {
	return s.UpdateF(ctx, src)
}
