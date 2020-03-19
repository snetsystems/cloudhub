package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.SourcesStore = &SourcesStore{}

// SourcesStore mock allows all functions to be set for testing
type SourcesStore struct {
	AllF    func(context.Context) ([]cloudhub.Source, error)
	AddF    func(context.Context, cloudhub.Source) (cloudhub.Source, error)
	DeleteF func(context.Context, cloudhub.Source) error
	GetF    func(ctx context.Context, ID int) (cloudhub.Source, error)
	UpdateF func(context.Context, cloudhub.Source) error
}

// All returns all sources in the store
func (s *SourcesStore) All(ctx context.Context) ([]cloudhub.Source, error) {
	return s.AllF(ctx)
}

// Add creates a new source in the SourcesStore and returns Source with ID
func (s *SourcesStore) Add(ctx context.Context, src cloudhub.Source) (cloudhub.Source, error) {
	return s.AddF(ctx, src)
}

// Delete the Source from the store
func (s *SourcesStore) Delete(ctx context.Context, src cloudhub.Source) error {
	return s.DeleteF(ctx, src)
}

// Get retrieves Source if `ID` exists
func (s *SourcesStore) Get(ctx context.Context, ID int) (cloudhub.Source, error) {
	return s.GetF(ctx, ID)
}

// Update the Source in the store.
func (s *SourcesStore) Update(ctx context.Context, src cloudhub.Source) error {
	return s.UpdateF(ctx, src)
}
