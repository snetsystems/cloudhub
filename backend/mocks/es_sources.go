package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.EsSourcesStore = &EsSourcesStore{}

// EsSourcesStore mock allows all functions to be set for testing
type EsSourcesStore struct {
	AllF    func(context.Context) ([]cloudhub.EsSource, error)
	AddF    func(context.Context, cloudhub.EsSource) (cloudhub.EsSource, error)
	DeleteF func(context.Context, cloudhub.EsSource) error
	GetF    func(ctx context.Context, ID int) (cloudhub.EsSource, error)
	UpdateF func(context.Context, cloudhub.EsSource) error
}

// All returns all sources in the store
func (s *EsSourcesStore) All(ctx context.Context) ([]cloudhub.EsSource, error) {
	return s.AllF(ctx)
}

// Add creates a new source in the EsSourcesStore and returns EsSource with ID
func (s *EsSourcesStore) Add(ctx context.Context, src cloudhub.EsSource) (cloudhub.EsSource, error) {
	return s.AddF(ctx, src)
}

// Delete the EsSource from the store
func (s *EsSourcesStore) Delete(ctx context.Context, src cloudhub.EsSource) error {
	return s.DeleteF(ctx, src)
}

// Get retrieves EsSource if `ID` exists
func (s *EsSourcesStore) Get(ctx context.Context, ID int) (cloudhub.EsSource, error) {
	return s.GetF(ctx, ID)
}

// Update the EsSource in the store.
func (s *EsSourcesStore) Update(ctx context.Context, src cloudhub.EsSource) error {
	return s.UpdateF(ctx, src)
}
