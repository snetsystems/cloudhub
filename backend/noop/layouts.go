package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure LayoutsStore implements cloudhub.LayoutsStore
var _ cloudhub.LayoutsStore = &LayoutsStore{}

// LayoutsStore ...
type LayoutsStore struct{}

// All ...
func (s *LayoutsStore) All(context.Context) ([]cloudhub.Layout, error) {
	return nil, fmt.Errorf("no layouts found")
}

// Add ...
func (s *LayoutsStore) Add(context.Context, cloudhub.Layout) (cloudhub.Layout, error) {
	return cloudhub.Layout{}, fmt.Errorf("failed to add layout")
}

// Delete ...
func (s *LayoutsStore) Delete(context.Context, cloudhub.Layout) error {
	return fmt.Errorf("failed to delete layout")
}

// Get ...
func (s *LayoutsStore) Get(ctx context.Context, ID string) (cloudhub.Layout, error) {
	return cloudhub.Layout{}, cloudhub.ErrLayoutNotFound
}

// Update ...
func (s *LayoutsStore) Update(context.Context, cloudhub.Layout) error {
	return fmt.Errorf("failed to update layout")
}
