package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure MappingsStore implements cmp.MappingsStore
var _ cmp.MappingsStore = &MappingsStore{}

// MappingsStore ...
type MappingsStore struct{}

// All ...
func (s *MappingsStore) All(context.Context) ([]cmp.Mapping, error) {
	return nil, fmt.Errorf("no mappings found")
}

// Add ...
func (s *MappingsStore) Add(context.Context, *cmp.Mapping) (*cmp.Mapping, error) {
	return nil, fmt.Errorf("failed to add mapping")
}

// Delete ...
func (s *MappingsStore) Delete(context.Context, *cmp.Mapping) error {
	return fmt.Errorf("failed to delete mapping")
}

// Get ...
func (s *MappingsStore) Get(ctx context.Context, ID string) (*cmp.Mapping, error) {
	return nil, cmp.ErrMappingNotFound
}

// Update ...
func (s *MappingsStore) Update(context.Context, *cmp.Mapping) error {
	return fmt.Errorf("failed to update mapping")
}
