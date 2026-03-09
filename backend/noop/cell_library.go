package noop

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.CellLibraryStore = &CellLibraryStore{}

// CellLibraryStore is a no-op implementation of cloudhub.CellLibraryStore
type CellLibraryStore struct{}

// All is a no-op.
func (s *CellLibraryStore) All(ctx context.Context) ([]cloudhub.LibraryCell, error) {
	return nil, nil
}

// Add is a no-op.
func (s *CellLibraryStore) Add(ctx context.Context, cell cloudhub.LibraryCell) (cloudhub.LibraryCell, error) {
	return cloudhub.LibraryCell{}, nil
}

// Get is a no-op.
func (s *CellLibraryStore) Get(ctx context.Context, id string) (cloudhub.LibraryCell, error) {
	return cloudhub.LibraryCell{}, cloudhub.ErrLibraryCellNotFound
}

// Delete is a no-op.
func (s *CellLibraryStore) Delete(ctx context.Context, cell cloudhub.LibraryCell) error {
	return nil
}

// Update is a no-op.
func (s *CellLibraryStore) Update(ctx context.Context, cell cloudhub.LibraryCell) error {
	return nil
}
