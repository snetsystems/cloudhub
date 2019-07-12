package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure LayoutsStore implements cmp.LayoutsStore
var _ cmp.LayoutsStore = &LayoutsStore{}

// LayoutsStore ...
type LayoutsStore struct{}

// All ...
func (s *LayoutsStore) All(context.Context) ([]cmp.Layout, error) {
	return nil, fmt.Errorf("no layouts found")
}

// Add ...
func (s *LayoutsStore) Add(context.Context, cmp.Layout) (cmp.Layout, error) {
	return cmp.Layout{}, fmt.Errorf("failed to add layout")
}

// Delete ...
func (s *LayoutsStore) Delete(context.Context, cmp.Layout) error {
	return fmt.Errorf("failed to delete layout")
}

// Get ...
func (s *LayoutsStore) Get(ctx context.Context, ID string) (cmp.Layout, error) {
	return cmp.Layout{}, cmp.ErrLayoutNotFound
}

// Update ...
func (s *LayoutsStore) Update(context.Context, cmp.Layout) error {
	return fmt.Errorf("failed to update layout")
}
