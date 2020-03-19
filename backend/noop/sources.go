package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure SourcesStore implements cloudhub.SourcesStore
var _ cloudhub.SourcesStore = &SourcesStore{}

// SourcesStore ...
type SourcesStore struct{}

// All ...
func (s *SourcesStore) All(context.Context) ([]cloudhub.Source, error) {
	return nil, fmt.Errorf("no sources found")
}

// Add ...
func (s *SourcesStore) Add(context.Context, cloudhub.Source) (cloudhub.Source, error) {
	return cloudhub.Source{}, fmt.Errorf("failed to add source")
}

// Delete ...
func (s *SourcesStore) Delete(context.Context, cloudhub.Source) error {
	return fmt.Errorf("failed to delete source")
}

// Get ...
func (s *SourcesStore) Get(ctx context.Context, ID int) (cloudhub.Source, error) {
	return cloudhub.Source{}, cloudhub.ErrSourceNotFound
}

// Update ...
func (s *SourcesStore) Update(context.Context, cloudhub.Source) error {
	return fmt.Errorf("failed to update source")
}
