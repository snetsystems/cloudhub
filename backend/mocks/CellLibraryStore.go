package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.CellLibraryStore = &CellLibraryStore{}

// CellLibraryStore is a mock implementation of cloudhub.CellLibraryStore
type CellLibraryStore struct {
	AllFunc    func(ctx context.Context) ([]cloudhub.LibraryCell, error)
	AddFunc    func(ctx context.Context, cell cloudhub.LibraryCell) (cloudhub.LibraryCell, error)
	GetFunc    func(ctx context.Context, id string) (cloudhub.LibraryCell, error)
	DeleteFunc func(ctx context.Context, cell cloudhub.LibraryCell) error
	UpdateFunc func(ctx context.Context, cell cloudhub.LibraryCell) error
}

// All mocks the All method
func (s *CellLibraryStore) All(ctx context.Context) ([]cloudhub.LibraryCell, error) {
	return s.AllFunc(ctx)
}

// Add mocks the Add method
func (s *CellLibraryStore) Add(ctx context.Context, cell cloudhub.LibraryCell) (cloudhub.LibraryCell, error) {
	return s.AddFunc(ctx, cell)
}

// Get mocks the Get method
func (s *CellLibraryStore) Get(ctx context.Context, id string) (cloudhub.LibraryCell, error) {
	return s.GetFunc(ctx, id)
}

// Delete mocks the Delete method
func (s *CellLibraryStore) Delete(ctx context.Context, cell cloudhub.LibraryCell) error {
	return s.DeleteFunc(ctx, cell)
}

// Update mocks the Update method
func (s *CellLibraryStore) Update(ctx context.Context, cell cloudhub.LibraryCell) error {
	return s.UpdateFunc(ctx, cell)
}
