package organizations

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure that ServersStore implements cmp.ServerStore
var _ cmp.ServersStore = &ServersStore{}

// ServersStore facade on a ServerStore that filters servers
// by organization.
type ServersStore struct {
	store        cmp.ServersStore
	organization string
}

// NewServersStore creates a new ServersStore from an existing
// cmp.ServerStore and an organization string
func NewServersStore(s cmp.ServersStore, org string) *ServersStore {
	return &ServersStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all servers from the underlying ServerStore and filters them
// by organization.
func (s *ServersStore) All(ctx context.Context) ([]cmp.Server, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	// This filters servers without allocating
	// https://github.com/golang/go/wiki/SliceTricks#filtering-without-allocating
	servers := ds[:0]
	for _, d := range ds {
		if d.Organization == s.organization {
			servers = append(servers, d)
		}
	}

	return servers, nil
}

// Add creates a new Server in the ServersStore with server.Organization set to be the
// organization from the server store.
func (s *ServersStore) Add(ctx context.Context, src cmp.Server) (cmp.Server, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cmp.Server{}, err
	}

	// make the newly added source "active"
	if err := s.resetActiveServer(ctx); err != nil {
		return cmp.Server{}, err
	}
	src.Active = true

	src.Organization = s.organization
	return s.store.Add(ctx, src)
}

// Delete the server from ServersStore
func (s *ServersStore) Delete(ctx context.Context, d cmp.Server) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	d, err = s.store.Get(ctx, d.ID)
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, d)
}

// Get returns a Server if the id exists and belongs to the organization that is set.
func (s *ServersStore) Get(ctx context.Context, id int) (cmp.Server, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cmp.Server{}, err
	}

	d, err := s.store.Get(ctx, id)
	if err != nil {
		return cmp.Server{}, err
	}

	if d.Organization != s.organization {
		return cmp.Server{}, cmp.ErrServerNotFound
	}

	return d, nil
}

// Update the server in ServersStore.
func (s *ServersStore) Update(ctx context.Context, src cmp.Server) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, src.ID)
	if err != nil {
		return err
	}

	// only one server can be active at a time
	if src.Active {
		if err := s.resetActiveServer(ctx); err != nil {
			return err
		}
	}

	return s.store.Update(ctx, src)
}

// resetActiveServer unsets the Active flag on all sources
func (s *ServersStore) resetActiveServer(ctx context.Context) error {
	srcs, err := s.All(ctx)
	if err != nil {
		return err
	}

	for _, other := range srcs {
		if other.Active {
			other.Active = false
			if err := s.store.Update(ctx, other); err != nil {
				return err
			}
		}
	}
	return nil
}
