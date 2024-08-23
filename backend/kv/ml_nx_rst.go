package kv

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure MLNxRstStore implements cloudhub.MLNxRstStore.
var _ cloudhub.MLNxRstStore = &MLNxRstStore{}

// MLNxRstStore is the bolt and etcd implementation of storing MLNxRst.
type MLNxRstStore struct {
	client *Service
}

// Add creates a new MLNxRst in the store
func (s *MLNxRstStore) Add(ctx context.Context, rst *cloudhub.MLNxRst) (*cloudhub.MLNxRst, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(mlNxRstBucket)

		if v, err := internal.MarshalMLNxRst(rst); err != nil {
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

// Get returns an MLNxRst if the id exists.
func (s *MLNxRstStore) Get(ctx context.Context, q cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	return nil, fmt.Errorf("must specify either ID in MLNxRst Query")
}

// get searches the store for an MLNxRst with the given id.
func (s *MLNxRstStore) get(ctx context.Context, id string) (*cloudhub.MLNxRst, error) {
	var rst cloudhub.MLNxRst
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(mlNxRstBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrMLNxRstNotFound
		}
		return internal.UnmarshalMLNxRst(v, &rst)
	})

	if err != nil {
		return nil, err
	}

	return &rst, nil
}

// Delete removes the MLNxRst from the store.
func (s *MLNxRstStore) Delete(ctx context.Context, rst *cloudhub.MLNxRst) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {

		_, err := s.get(ctx, rst.Device)
		if err != nil {
			return cloudhub.ErrMLNxRstNotFound
		}

		if err := tx.Bucket(mlNxRstBucket).Delete([]byte(rst.Device)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Update modifies an existing MLNxRst in the store.
func (s *MLNxRstStore) Update(ctx context.Context, rst *cloudhub.MLNxRst) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {

		// Get an existing MLNxRst with the same ID.
		_, err := s.get(ctx, rst.Device)
		if err != nil {
			return cloudhub.ErrMLNxRstNotFound
		}

		if v, err := internal.MarshalMLNxRst(rst); err != nil {
			return err
		} else if err := tx.Bucket(mlNxRstBucket).Put([]byte(rst.Device), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// All returns all known MLNxRst records.
func (s *MLNxRstStore) All(ctx context.Context) ([]cloudhub.MLNxRst, error) {
	var rsts []cloudhub.MLNxRst
	err := s.each(ctx, func(o *cloudhub.MLNxRst) {
		rsts = append(rsts, *o)
	})

	if err != nil {
		return nil, err
	}

	return rsts, nil
}

// each iterates through all MLNxRst records in the store.
func (s *MLNxRstStore) each(ctx context.Context, fn func(*cloudhub.MLNxRst)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(mlNxRstBucket).ForEach(func(k, v []byte) error {
			var rst cloudhub.MLNxRst
			if err := internal.UnmarshalMLNxRst(v, &rst); err != nil {
				return err
			}
			fn(&rst)
			return nil
		})
	})
}
