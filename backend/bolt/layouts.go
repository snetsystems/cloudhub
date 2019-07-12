package bolt

import (
	"context"

	"github.com/boltdb/bolt"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/bolt/internal"
)

// Ensure LayoutsStore implements cmp.LayoutsStore.
var _ cmp.LayoutsStore = &LayoutsStore{}

// LayoutsBucket is the bolt bucket layouts are stored in
var LayoutsBucket = []byte("Layout")

// LayoutsStore is the bolt implementation to store layouts
type LayoutsStore struct {
	client *Client
	IDs    cmp.ID
}

// Migrate ...
func (s *LayoutsStore) Migrate(ctx context.Context) error {
	return nil
}

// All returns all known layouts
func (s *LayoutsStore) All(ctx context.Context) ([]cmp.Layout, error) {
	var srcs []cmp.Layout
	if err := s.client.db.View(func(tx *bolt.Tx) error {
		if err := tx.Bucket(LayoutsBucket).ForEach(func(k, v []byte) error {
			var src cmp.Layout
			if err := internal.UnmarshalLayout(v, &src); err != nil {
				return err
			}
			srcs = append(srcs, src)
			return nil
		}); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return srcs, nil

}

// Add creates a new Layout in the LayoutsStore.
func (s *LayoutsStore) Add(ctx context.Context, src cmp.Layout) (cmp.Layout, error) {
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(LayoutsBucket)
		id, err := s.IDs.Generate()
		if err != nil {
			return err
		}

		src.ID = id
		if v, err := internal.MarshalLayout(src); err != nil {
			return err
		} else if err := b.Put([]byte(src.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cmp.Layout{}, err
	}

	return src, nil
}

// Delete removes the Layout from the LayoutsStore
func (s *LayoutsStore) Delete(ctx context.Context, src cmp.Layout) error {
	_, err := s.Get(ctx, src.ID)
	if err != nil {
		return err
	}
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		if err := tx.Bucket(LayoutsBucket).Delete([]byte(src.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Get returns a Layout if the id exists.
func (s *LayoutsStore) Get(ctx context.Context, id string) (cmp.Layout, error) {
	var src cmp.Layout
	if err := s.client.db.View(func(tx *bolt.Tx) error {
		if v := tx.Bucket(LayoutsBucket).Get([]byte(id)); v == nil {
			return cmp.ErrLayoutNotFound
		} else if err := internal.UnmarshalLayout(v, &src); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cmp.Layout{}, err
	}

	return src, nil
}

// Update a Layout
func (s *LayoutsStore) Update(ctx context.Context, src cmp.Layout) error {
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		// Get an existing layout with the same ID.
		b := tx.Bucket(LayoutsBucket)
		if v := b.Get([]byte(src.ID)); v == nil {
			return cmp.ErrLayoutNotFound
		}

		if v, err := internal.MarshalLayout(src); err != nil {
			return err
		} else if err := b.Put([]byte(src.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}
