package bolt

import (
	"context"
	"fmt"

	"github.com/boltdb/bolt"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/bolt/internal"
)

// Ensure MappingsStore implements cloudhub.MappingsStore.
var _ cloudhub.MappingsStore = &MappingsStore{}

var (
	// MappingsBucket is the bucket where organizations are stored.
	MappingsBucket = []byte("MappingsV1")
)

// MappingsStore uses bolt to store and retrieve Mappings
type MappingsStore struct {
	client *Client
}

// Migrate sets the default organization at runtime
func (s *MappingsStore) Migrate(ctx context.Context) error {
	return nil
}

// Add creates a new Mapping in the MappingsStore
func (s *MappingsStore) Add(ctx context.Context, o *cloudhub.Mapping) (*cloudhub.Mapping, error) {
	err := s.client.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(MappingsBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		o.ID = fmt.Sprintf("%d", seq)

		v, err := internal.MarshalMapping(o)
		if err != nil {
			return err
		}

		return b.Put([]byte(o.ID), v)
	})

	if err != nil {
		return nil, err
	}

	return o, nil
}

// All returns all known organizations
func (s *MappingsStore) All(ctx context.Context) ([]cloudhub.Mapping, error) {
	var mappings []cloudhub.Mapping
	err := s.each(ctx, func(m *cloudhub.Mapping) {
		mappings = append(mappings, *m)
	})

	if err != nil {
		return nil, err
	}

	return mappings, nil
}

// Delete the organization from MappingsStore
func (s *MappingsStore) Delete(ctx context.Context, o *cloudhub.Mapping) error {
	_, err := s.get(ctx, o.ID)
	if err != nil {
		return err
	}
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(MappingsBucket).Delete([]byte(o.ID))
	}); err != nil {
		return err
	}
	return nil
}

func (s *MappingsStore) get(ctx context.Context, id string) (*cloudhub.Mapping, error) {
	var o cloudhub.Mapping
	err := s.client.db.View(func(tx *bolt.Tx) error {
		v := tx.Bucket(MappingsBucket).Get([]byte(id))
		if v == nil {
			return cloudhub.ErrMappingNotFound
		}
		return internal.UnmarshalMapping(v, &o)
	})

	if err != nil {
		return nil, err
	}

	return &o, nil
}

func (s *MappingsStore) each(ctx context.Context, fn func(*cloudhub.Mapping)) error {
	return s.client.db.View(func(tx *bolt.Tx) error {
		return tx.Bucket(MappingsBucket).ForEach(func(k, v []byte) error {
			var m cloudhub.Mapping
			if err := internal.UnmarshalMapping(v, &m); err != nil {
				return err
			}
			fn(&m)
			return nil
		})
	})
}

// Get returns a Mapping if the id exists.
func (s *MappingsStore) Get(ctx context.Context, id string) (*cloudhub.Mapping, error) {
	return s.get(ctx, id)
}

// Update the organization in MappingsStore
func (s *MappingsStore) Update(ctx context.Context, o *cloudhub.Mapping) error {
	return s.client.db.Update(func(tx *bolt.Tx) error {
		if v, err := internal.MarshalMapping(o); err != nil {
			return err
		} else if err := tx.Bucket(MappingsBucket).Put([]byte(o.ID), v); err != nil {
			return err
		}
		return nil
	})
}
