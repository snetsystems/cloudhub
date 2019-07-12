package bolt

import (
	"context"

	"github.com/boltdb/bolt"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/bolt/internal"
)

// Ensure ServersStore implements cmp.ServersStore.
var _ cmp.ServersStore = &ServersStore{}

// ServersBucket is the bolt bucket to store lists of servers
var ServersBucket = []byte("Servers")

// ServersStore is the bolt implementation to store servers in a store.
// Used store servers that are associated in some way with a source
type ServersStore struct {
	client *Client
}

// Migrate ...
func (s *ServersStore) Migrate(ctx context.Context) error {
	servers, err := s.All(ctx)
	if err != nil {
		return err
	}

	defaultOrg, err := s.client.OrganizationsStore.DefaultOrganization(ctx)
	if err != nil {
		return err
	}

	for _, server := range servers {
		if server.Organization == "" {
			server.Organization = defaultOrg.ID
			if err := s.Update(ctx, server); err != nil {
				return nil
			}
		}
	}

	return nil
}

// All returns all known servers
func (s *ServersStore) All(ctx context.Context) ([]cmp.Server, error) {
	var srcs []cmp.Server
	if err := s.client.db.View(func(tx *bolt.Tx) error {
		var err error
		srcs, err = s.all(ctx, tx)
		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return srcs, nil

}

// Add creates a new Server in the ServerStore.
func (s *ServersStore) Add(ctx context.Context, src cmp.Server) (cmp.Server, error) {
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(ServersBucket)
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
		return cmp.Server{}, err
	}

	return src, nil
}

// Delete removes the Server from the ServersStore
func (s *ServersStore) Delete(ctx context.Context, src cmp.Server) error {
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		if err := tx.Bucket(ServersBucket).Delete(itob(src.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Get returns a Server if the id exists.
func (s *ServersStore) Get(ctx context.Context, id int) (cmp.Server, error) {
	var src cmp.Server
	if err := s.client.db.View(func(tx *bolt.Tx) error {
		if v := tx.Bucket(ServersBucket).Get(itob(id)); v == nil {
			return cmp.ErrServerNotFound
		} else if err := internal.UnmarshalServer(v, &src); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cmp.Server{}, err
	}

	return src, nil
}

// Update a Server
func (s *ServersStore) Update(ctx context.Context, src cmp.Server) error {
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		// Get an existing server with the same ID.
		b := tx.Bucket(ServersBucket)
		if v := b.Get(itob(src.ID)); v == nil {
			return cmp.ErrServerNotFound
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

func (s *ServersStore) all(ctx context.Context, tx *bolt.Tx) ([]cmp.Server, error) {
	var srcs []cmp.Server
	if err := tx.Bucket(ServersBucket).ForEach(func(k, v []byte) error {
		var src cmp.Server
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
