package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure MappingsStore implements cloudhub.MappingsStore
var _ cloudhub.MappingsStore = &MappingsStore{}

// MappingsStore ...
type MappingsStore struct{}

// All ...
func (s *MappingsStore) All(context.Context) ([]cloudhub.Mapping, error) {
	return nil, fmt.Errorf("no mappings found")
}

// Add ...
func (s *MappingsStore) Add(context.Context, *cloudhub.Mapping) (*cloudhub.Mapping, error) {
	return nil, fmt.Errorf("failed to add mapping")
}

// Delete ...
func (s *MappingsStore) Delete(context.Context, *cloudhub.Mapping) error {
	return fmt.Errorf("failed to delete mapping")
}

// Get ...
func (s *MappingsStore) Get(ctx context.Context, ID string) (*cloudhub.Mapping, error) {
	return nil, cloudhub.ErrMappingNotFound
}

// Update ...
func (s *MappingsStore) Update(context.Context, *cloudhub.Mapping) error {
	return fmt.Errorf("failed to update mapping")
}
