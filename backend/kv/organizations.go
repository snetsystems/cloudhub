package kv

import (
	"context"
	"errors"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// Ensure organizationsStore implements cloudhub.OrganizationsStore.
var _ cloudhub.OrganizationsStore = &organizationsStore{}

var (
	// DefaultOrganizationID is the ID of the default organization.
	DefaultOrganizationID = []byte("default")
)

const (
	// DefaultOrganizationName is the Name of the default organization
	DefaultOrganizationName string = "Default"
	// DefaultOrganizationRole is the DefaultRole for the Default organization
	DefaultOrganizationRole string = "member"
)

// organizationsStore uses a kv to store and retrieve Organizations
type organizationsStore struct {
	client *Service
}

// CreateDefault does a findOrCreate on the default organization
func (s *organizationsStore) CreateDefault(ctx context.Context) error {
	o := cloudhub.Organization{
		ID:          string(DefaultOrganizationID),
		Name:        DefaultOrganizationName,
		DefaultRole: DefaultOrganizationRole,
	}

	return s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(organizationsBucket)
		v, _ := b.Get(DefaultOrganizationID)
		if v != nil {
			return nil
		}
		if v, err := internal.MarshalOrganization(&o); err != nil {
			return err
		} else if err := b.Put(DefaultOrganizationID, v); err != nil {
			return err
		}

		b = tx.Bucket(mappingsBucket)
		v, _ = b.Get(DefaultOrganizationID)
		if v != nil {
			return nil
		}
		if v, err := internal.MarshalMapping(&cloudhub.Mapping{
			ID:                   string(DefaultOrganizationID),
			Organization:         string(DefaultOrganizationID),
			Provider:             cloudhub.MappingWildcard,
			Scheme:               cloudhub.MappingWildcard,
			ProviderOrganization: cloudhub.MappingWildcard,
		}); err != nil {
			return err
		} else if err := b.Put(DefaultOrganizationID, v); err != nil {
			return err
		}

		return nil
	})
}

func (s *organizationsStore) nameIsUnique(ctx context.Context, name string) bool {
	_, err := s.Get(ctx, cloudhub.OrganizationQuery{Name: &name})
	switch err {
	case cloudhub.ErrOrganizationNotFound:
		return true
	default:
		return false
	}
}

// DefaultOrganization returns the default organization
func (s *organizationsStore) DefaultOrganization(ctx context.Context) (*cloudhub.Organization, error) {
	var org cloudhub.Organization
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(organizationsBucket).Get(DefaultOrganizationID)
		if err != nil {
			return err
		}
		return internal.UnmarshalOrganization(v, &org)
	}); err != nil {
		return nil, err
	}

	return &org, nil
}

// Add creates a new Organization in the organizationsStore
func (s *organizationsStore) Add(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
	if !s.nameIsUnique(ctx, o.Name) {
		return nil, cloudhub.ErrOrganizationAlreadyExists
	}
	err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(organizationsBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		o.ID = strconv.FormatUint(seq, 10)

		v, err := internal.MarshalOrganization(o)
		if err != nil {
			return err
		}

		return b.Put([]byte(o.ID), v)
	})

	return o, err
}

// All returns all known organizations
func (s *organizationsStore) All(ctx context.Context) ([]cloudhub.Organization, error) {
	var orgs []cloudhub.Organization
	err := s.each(ctx, func(o *cloudhub.Organization) {
		orgs = append(orgs, *o)
	})

	if err != nil {
		return nil, err
	}

	return orgs, nil
}

// Delete the organization from organizationsStore
func (s *organizationsStore) Delete(ctx context.Context, o *cloudhub.Organization) error {
	if o.ID == string(DefaultOrganizationID) {
		return cloudhub.ErrCannotDeleteDefaultOrganization
	}
	_, err := s.get(ctx, o.ID)
	if err != nil {
		return err
	}
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		return tx.Bucket(organizationsBucket).Delete([]byte(o.ID))
	}); err != nil {
		return err
	}

	// Dependent Delete of all resources

	// Each of the associated organization stores expects organization to be
	// set on the context.
	if ctx == nil {
		ctx = context.Background() // context could be possible nil before go 1.15, see https://github.com/golang/go/issues/40737
	}
	ctx = context.WithValue(ctx, organizations.ContextKey, o.ID)

	sourcesStore := organizations.NewSourcesStore(s.client.SourcesStore(), o.ID)
	sources, err := sourcesStore.All(ctx)
	if err != nil {
		return err
	}
	for _, source := range sources {
		if err := sourcesStore.Delete(ctx, source); err != nil {
			return err
		}
	}

	serversStore := organizations.NewServersStore(s.client.ServersStore(), o.ID)
	servers, err := serversStore.All(ctx)
	if err != nil {
		return err
	}
	for _, server := range servers {
		if err := serversStore.Delete(ctx, server); err != nil {
			return err
		}
	}

	dashboardsStore := organizations.NewDashboardsStore(s.client.DashboardsStore(), o.ID)
	dashboards, err := dashboardsStore.All(ctx)
	if err != nil {
		return err
	}
	for _, dashboard := range dashboards {
		if err := dashboardsStore.Delete(ctx, dashboard); err != nil {
			return err
		}
	}

	usersStore := organizations.NewUsersStore(s.client.UsersStore(), o.ID)
	users, err := usersStore.All(ctx)
	if err != nil {
		return err
	}
	for _, user := range users {
		if err := usersStore.Delete(ctx, &user); err != nil {
			return err
		}
	}

	mappings, err := s.client.MappingsStore().All(ctx)
	if err != nil {
		return err
	}
	for _, mapping := range mappings {
		if mapping.Organization == o.ID {
			if err := s.client.MappingsStore().Delete(ctx, &mapping); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *organizationsStore) get(ctx context.Context, id string) (*cloudhub.Organization, error) {
	var o cloudhub.Organization
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(organizationsBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrOrganizationNotFound
		}
		return internal.UnmarshalOrganization(v, &o)
	})

	if err != nil {
		return nil, err
	}

	return &o, nil
}

func (s *organizationsStore) each(ctx context.Context, fn func(*cloudhub.Organization)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(organizationsBucket).ForEach(func(k, v []byte) error {
			var org cloudhub.Organization
			if err := internal.UnmarshalOrganization(v, &org); err != nil {
				return err
			}
			fn(&org)
			return nil
		})
	})
}

// Get returns a Organization if the id exists.
// If an ID is provided in the query, the lookup time for an organization will be O(1).
// If Name is provided, the lookup time will be O(n).
// Get expects that only one of ID or Name will be specified, but will prefer ID over Name if both are specified.
func (s *organizationsStore) Get(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	if q.Name != nil {
		var org *cloudhub.Organization
		err := s.each(ctx, func(o *cloudhub.Organization) {
			if org != nil {
				return
			}

			if o.Name == *q.Name {
				org = o
			}
		})

		if err != nil {
			return nil, err
		}

		if org == nil {
			return nil, cloudhub.ErrOrganizationNotFound
		}

		return org, nil
	}
	return nil, errors.New("must specify either ID, or Name in OrganizationQuery")
}

// Update the organization in organizationsStore
func (s *organizationsStore) Update(ctx context.Context, o *cloudhub.Organization) error {
	org, err := s.get(ctx, o.ID)
	if err != nil {
		return err
	}
	if o.Name != org.Name && !s.nameIsUnique(ctx, o.Name) {
		return cloudhub.ErrOrganizationAlreadyExists
	}
	return s.client.kv.Update(ctx, func(tx Tx) error {
		if v, err := internal.MarshalOrganization(o); err != nil {
			return err
		} else if err := tx.Bucket(organizationsBucket).Put([]byte(o.ID), v); err != nil {
			return err
		}
		return nil
	})
}
