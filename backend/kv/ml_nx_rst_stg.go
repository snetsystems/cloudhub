package kv

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure MLNxRstStore implements cloudhub.MLNxRstStore.
var _ cloudhub.DLNxRstStgStore = &DLNxRstStgStore{}

// DLNxRstStgStore is the bolt and etcd implementation of storing MLNxRst.
type DLNxRstStgStore struct {
	client *Service
}

// Delete removes the MLNxRst from the store.
func (s *DLNxRstStgStore) Delete(ctx context.Context, q cloudhub.DLNxRstStgQuery) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {

		if q.ID == nil {
			return cloudhub.ErrMLNxRstNotFound
		}
		existingKey, err := tx.Bucket(dLNxRstStgBucket).Exists([]byte(*q.ID))
		if !existingKey || err != nil {
			return nil
		}

		if err := tx.Bucket(dLNxRstStgBucket).Delete([]byte(*q.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}
