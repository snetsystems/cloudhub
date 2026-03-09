package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that CellLibraryStore implements cloudhub.CellLibraryStore
var _ cloudhub.CellLibraryStore = &CellLibraryStore{}

// CellLibraryStore is a facade on a CellLibraryStore that filters library cells
// by organization.
type CellLibraryStore struct {
	store        cloudhub.CellLibraryStore
	organization string
}

// NewCellLibraryStore creates a new CellLibraryStore from an existing
// cloudhub.CellLibraryStore and an organization string
func NewCellLibraryStore(s cloudhub.CellLibraryStore, org string) *CellLibraryStore {
	return &CellLibraryStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all library cells from the underlying CellLibraryStore and filters them
// by organization.
func (s *CellLibraryStore) All(ctx context.Context) ([]cloudhub.LibraryCell, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	cells, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	// Filter cells by organization
	filtered := cells[:0]
	for _, cell := range cells {
		if cell.Organization == s.organization {
			filtered = append(filtered, cell)
		}
	}

	return filtered, nil
}

// Add creates a new LibraryCell in the CellLibraryStore with cell.Organization set to be the
// organization from the cell library store.
func (s *CellLibraryStore) Add(ctx context.Context, cell cloudhub.LibraryCell) (cloudhub.LibraryCell, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.LibraryCell{}, err
	}

	cell.Organization = s.organization
	return s.store.Add(ctx, cell)
}

// Delete removes the library cell from CellLibraryStore
func (s *CellLibraryStore) Delete(ctx context.Context, cell cloudhub.LibraryCell) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	existing, err := s.store.Get(ctx, cell.ID)
	if err != nil {
		return err
	}

	if existing.Organization != s.organization {
		return cloudhub.ErrLibraryCellNotFound
	}

	return s.store.Delete(ctx, cell)
}

// Get returns a LibraryCell if the id exists and belongs to the organization that is set.
func (s *CellLibraryStore) Get(ctx context.Context, id string) (cloudhub.LibraryCell, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.LibraryCell{}, err
	}

	cell, err := s.store.Get(ctx, id)
	if err != nil {
		return cloudhub.LibraryCell{}, err
	}

	if cell.Organization != s.organization {
		return cloudhub.LibraryCell{}, cloudhub.ErrLibraryCellNotFound
	}

	return cell, nil
}

// Update updates the library cell in CellLibraryStore.
func (s *CellLibraryStore) Update(ctx context.Context, cell cloudhub.LibraryCell) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	existing, err := s.store.Get(ctx, cell.ID)
	if err != nil {
		return err
	}

	if existing.Organization != s.organization {
		return cloudhub.ErrLibraryCellNotFound
	}

	return s.store.Update(ctx, cell)
}
