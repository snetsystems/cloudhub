package kv

import (
	"context"
	"encoding/json"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure cellLibraryStore implements cloudhub.CellLibraryStore
var _ cloudhub.CellLibraryStore = &cellLibraryStore{}

// cellLibraryStore is the bolt implementation
type cellLibraryStore struct {
	client *Service
	IDs    cloudhub.ID
}

// All lists all library cells
func (s *cellLibraryStore) All(ctx context.Context) ([]cloudhub.LibraryCell, error) {
	var cells []cloudhub.LibraryCell
	err := s.client.kv.View(ctx, func(tx Tx) error {
		b := tx.Bucket(libraryCellsBucket)
		return b.ForEach(func(k, v []byte) error {
			var c cloudhub.LibraryCell
			if err := json.Unmarshal(v, &c); err != nil {
				return err
			}
			cells = append(cells, c)
			return nil
		})
	})
	return cells, err
}

// Add creates a new library cell
func (s *cellLibraryStore) Add(ctx context.Context, cell cloudhub.LibraryCell) (cloudhub.LibraryCell, error) {
	err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(libraryCellsBucket)

		// Generate ID if not provided
		if cell.ID == "" {
			id, err := s.IDs.Generate()
			if err != nil {
				return err
			}
			cell.ID = id
		}

		v, err := json.Marshal(cell)
		if err != nil {
			return err
		}
		return b.Put([]byte(cell.ID), v)
	})
	if err != nil {
		return cloudhub.LibraryCell{}, err
	}
	return cell, nil
}

// Get retrieves a library cell
func (s *cellLibraryStore) Get(ctx context.Context, id string) (cloudhub.LibraryCell, error) {
	var cell cloudhub.LibraryCell
	err := s.client.kv.View(ctx, func(tx Tx) error {
		b := tx.Bucket(libraryCellsBucket)
		v, err := b.Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrLibraryCellNotFound
		}
		return json.Unmarshal(v, &cell)
	})
	if err != nil {
		return cloudhub.LibraryCell{}, err
	}
	return cell, nil
}

// Delete removes a library cell
func (s *cellLibraryStore) Delete(ctx context.Context, cell cloudhub.LibraryCell) error {
	return s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(libraryCellsBucket)
		return b.Delete([]byte(cell.ID))
	})
}

// Update updates a library cell
func (s *cellLibraryStore) Update(ctx context.Context, cell cloudhub.LibraryCell) error {
	return s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(libraryCellsBucket)

		// Check existence
		if v, err := b.Get([]byte(cell.ID)); v == nil || err != nil {
			return cloudhub.ErrLibraryCellNotFound
		}

		v, err := json.Marshal(cell)
		if err != nil {
			return err
		}
		return b.Put([]byte(cell.ID), v)
	})
}
