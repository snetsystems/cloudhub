package kv

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure serversStore implements cloudhub.ServersStore.
var _ cloudhub.ServersStore = &serversStore{}

// serversStore is the implementation to store servers in a store.
// Used store servers that are associated in some way with a source
type serversStore struct {
	client *Service
}

// All returns all known servers
func (s *serversStore) All(ctx context.Context) ([]cloudhub.Server, error) {
	var srcs []cloudhub.Server
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		var err error
		srcs, err = allServers(ctx, tx)
		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return srcs, nil
}

func allServers(ctx context.Context, tx Tx) ([]cloudhub.Server, error) {
	var srcs []cloudhub.Server
	if err := tx.Bucket(serversBucket).ForEach(func(k, v []byte) error {
		var src cloudhub.Server
		if err := internal.UnmarshalServer(v, &src); err != nil {
			return err
		}
		srcs = append(srcs, src)
		return nil
	}); err != nil {
		return srcs, err
	}
	return srcs, nil
}

// Add creates a new Server in the ServerStore.
func (s *serversStore) Add(ctx context.Context, src cloudhub.Server) (cloudhub.Server, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(serversBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		src.ID = int(seq)

		if v, err := internal.MarshalServer(src); err != nil {
			return err
		} else if err := b.Put(itob(src.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cloudhub.Server{}, err
	}

	return src, nil
}

// Delete removes the Server from the serversStore
func (s *serversStore) Delete(ctx context.Context, src cloudhub.Server) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		if err := tx.Bucket(serversBucket).Delete(itob(src.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Get returns a Server if the id exists.
func (s *serversStore) Get(ctx context.Context, id int) (cloudhub.Server, error) {
	var src cloudhub.Server
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		if v, err := tx.Bucket(serversBucket).Get(itob(id)); v == nil || err != nil {
			return cloudhub.ErrServerNotFound
		} else if err := internal.UnmarshalServer(v, &src); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cloudhub.Server{}, err
	}

	return src, nil
}

// Update a Server
func (s *serversStore) Update(ctx context.Context, src cloudhub.Server) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		// Get an existing server with the same ID.
		b := tx.Bucket(serversBucket)
		if v, err := b.Get(itob(src.ID)); v == nil || err != nil {
			return cloudhub.ErrServerNotFound
		}

		if v, err := internal.MarshalServer(src); err != nil {
			return err
		} else if err := b.Put(itob(src.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}
