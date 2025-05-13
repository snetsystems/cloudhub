package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure EsSourceStore implements cloudhub.EsSourceStore
var _ cloudhub.EsSourcesStore = &EsSourcesStore{}

// EsSourcesStore ...
type EsSourcesStore struct{}

// All ...
func (s *EsSourcesStore) All(context.Context) ([]cloudhub.EsSource, error) {
	return nil, fmt.Errorf("no sources found")
}

// Add ...
func (s *EsSourcesStore) Add(context.Context, cloudhub.EsSource) (cloudhub.EsSource, error) {
	return cloudhub.EsSource{}, fmt.Errorf("failed to add source")
}

// Delete ...
func (s *EsSourcesStore) Delete(context.Context, cloudhub.EsSource) error {
	return fmt.Errorf("failed to delete source")
}

// Get ...
func (s *EsSourcesStore) Get(ctx context.Context, ID int) (cloudhub.EsSource, error) {
	return cloudhub.EsSource{}, cloudhub.ErrSourceNotFound
}

// Update ...
func (s *EsSourcesStore) Update(context.Context, cloudhub.EsSource) error {
	return fmt.Errorf("failed to update source")
}
