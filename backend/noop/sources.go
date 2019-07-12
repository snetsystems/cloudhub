package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure SourcesStore implements cmp.SourcesStore
var _ cmp.SourcesStore = &SourcesStore{}

// SourcesStore ...
type SourcesStore struct{}

// All ...
func (s *SourcesStore) All(context.Context) ([]cmp.Source, error) {
	return nil, fmt.Errorf("no sources found")
}

// Add ...
func (s *SourcesStore) Add(context.Context, cmp.Source) (cmp.Source, error) {
	return cmp.Source{}, fmt.Errorf("failed to add source")
}

// Delete ...
func (s *SourcesStore) Delete(context.Context, cmp.Source) error {
	return fmt.Errorf("failed to delete source")
}

// Get ...
func (s *SourcesStore) Get(ctx context.Context, ID int) (cmp.Source, error) {
	return cmp.Source{}, cmp.ErrSourceNotFound
}

// Update ...
func (s *SourcesStore) Update(context.Context, cmp.Source) error {
	return fmt.Errorf("failed to update source")
}
