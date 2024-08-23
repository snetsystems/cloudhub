package kv

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure DLNxRstStore implements cloudhub.DLNxRstStore.
var _ cloudhub.DLNxRstStore = &DLNxRstStore{}

// DLNxRstStore is the bolt and etcd implementation of storing DLNxRst.
type DLNxRstStore struct {
	client *Service
}

// Add creates a new DLNxRst in the store.
func (s *DLNxRstStore) Add(ctx context.Context, rst *cloudhub.DLNxRst) (*cloudhub.DLNxRst, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(dlNxRstBucket)

		if v, err := internal.MarshalDLNxRst(rst); err != nil {
			return err
		} else if err := b.Put([]byte(rst.Device), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return rst, nil
}

// Get returns a DLNxRst if the id exists.
func (s *DLNxRstStore) Get(ctx context.Context, q cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	return nil, fmt.Errorf("must specify either ID in DLNxRst Query")
}

// get searches the store for a DLNxRst with the given id.
func (s *DLNxRstStore) get(ctx context.Context, id string) (*cloudhub.DLNxRst, error) {
	var rst cloudhub.DLNxRst
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(dlNxRstBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrDLNxRstNotFound
		}
		return internal.UnmarshalDLNxRst(v, &rst)
	})

	if err != nil {
		return nil, err
	}

	return &rst, nil
}

// Delete removes the DLNxRst from the store.
func (s *DLNxRstStore) Delete(ctx context.Context, rst *cloudhub.DLNxRst) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {

		_, err := s.get(ctx, rst.Device)
		if err != nil {
			return cloudhub.ErrDLNxRstNotFound
		}

		if err := tx.Bucket(dlNxRstBucket).Delete([]byte(rst.Device)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Update modifies an existing DLNxRst in the store.
func (s *DLNxRstStore) Update(ctx context.Context, rst *cloudhub.DLNxRst) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {

		// Get an existing DLNxRst with the same ID.
		_, err := s.get(ctx, rst.Device)
		if err != nil {
			return cloudhub.ErrDLNxRstNotFound
		}

		if v, err := internal.MarshalDLNxRst(rst); err != nil {
			return err
		} else if err := tx.Bucket(dlNxRstBucket).Put([]byte(rst.Device), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// All returns all known DLNxRst records.
func (s *DLNxRstStore) All(ctx context.Context) ([]cloudhub.DLNxRst, error) {
	var rsts []cloudhub.DLNxRst
	err := s.each(ctx, func(o *cloudhub.DLNxRst) {
		rsts = append(rsts, *o)
	})

	if err != nil {
		return nil, err
	}

	return rsts, nil
}

// each iterates through all DLNxRst records in the store.
func (s *DLNxRstStore) each(ctx context.Context, fn func(*cloudhub.DLNxRst)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(dlNxRstBucket).ForEach(func(k, v []byte) error {
			var rst cloudhub.DLNxRst
			if err := internal.UnmarshalDLNxRst(v, &rst); err != nil {
				return err
			}
			fn(&rst)
			return nil
		})
	})
}
