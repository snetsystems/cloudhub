package bolt

import (
	"context"
	"fmt"

	"github.com/boltdb/bolt"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/bolt/internal"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// Ensure OrganizationsStore implements cloudhub.OrganizationsStore.
var _ cloudhub.OrganizationsStore = &OrganizationsStore{}

var (
	// OrganizationsBucket is the bucket where organizations are stored.
	OrganizationsBucket = []byte("OrganizationsV1")
	// DefaultOrganizationID is the ID of the default organization.
	DefaultOrganizationID = []byte("default")
)

const (
	// DefaultOrganizationName is the Name of the default organization
	DefaultOrganizationName string = "Default"
	// DefaultOrganizationRole is the DefaultRole for the Default organization
	DefaultOrganizationRole string = "member"
)

// OrganizationsStore uses bolt to store and retrieve Organizations
type OrganizationsStore struct {
	client *Client
}

// Migrate sets the default organization at runtime
func (s *OrganizationsStore) Migrate(ctx context.Context) error {
	return s.CreateDefault(ctx)
}

// CreateDefault does a findOrCreate on the default organization
func (s *OrganizationsStore) CreateDefault(ctx context.Context) error {
	o := cloudhub.Organization{
		ID:          string(DefaultOrganizationID),
		Name:        DefaultOrganizationName,
		DefaultRole: DefaultOrganizationRole,
	}

	m := cloudhub.Mapping{
		ID:                   string(DefaultOrganizationID),
		Organization:         string(DefaultOrganizationID),
		Provider:             cloudhub.MappingWildcard,
		Scheme:               cloudhub.MappingWildcard,
		ProviderOrganization: cloudhub.MappingWildcard,
	}
	return s.client.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(OrganizationsBucket)
		v := b.Get(DefaultOrganizationID)
		if v != nil {
			return nil
		}
		if v, err := internal.MarshalOrganization(&o); err != nil {
			return err
		} else if err := b.Put(DefaultOrganizationID, v); err != nil {
			return err
		}

		b = tx.Bucket(MappingsBucket)
		v = b.Get(DefaultOrganizationID)
		if v != nil {
			return nil
		}
		if v, err := internal.MarshalMapping(&m); err != nil {
			return err
		} else if err := b.Put(DefaultOrganizationID, v); err != nil {
			return err
		}

		return nil
	})
}

func (s *OrganizationsStore) nameIsUnique(ctx context.Context, name string) bool {
	_, err := s.Get(ctx, cloudhub.OrganizationQuery{Name: &name})
	switch err {
	case cloudhub.ErrOrganizationNotFound:
		return true
	default:
		return false
	}
}

// DefaultOrganization returns the default organization
func (s *OrganizationsStore) DefaultOrganization(ctx context.Context) (*cloudhub.Organization, error) {
	var org cloudhub.Organization
	if err := s.client.db.View(func(tx *bolt.Tx) error {
		v := tx.Bucket(OrganizationsBucket).Get(DefaultOrganizationID)
		return internal.UnmarshalOrganization(v, &org)
	}); err != nil {
		return nil, err
	}

	return &org, nil
}

// Add creates a new Organization in the OrganizationsStore
func (s *OrganizationsStore) Add(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
	if !s.nameIsUnique(ctx, o.Name) {
		return nil, cloudhub.ErrOrganizationAlreadyExists
	}
	err := s.client.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(OrganizationsBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		o.ID = fmt.Sprintf("%d", seq)

		v, err := internal.MarshalOrganization(o)
		if err != nil {
			return err
		}

		return b.Put([]byte(o.ID), v)
	})

	return o, err
}

// All returns all known organizations
func (s *OrganizationsStore) All(ctx context.Context) ([]cloudhub.Organization, error) {
	var orgs []cloudhub.Organization
	err := s.each(ctx, func(o *cloudhub.Organization) {
		orgs = append(orgs, *o)
	})

	if err != nil {
		return nil, err
	}

	return orgs, nil
}

// Delete the organization from OrganizationsStore
func (s *OrganizationsStore) Delete(ctx context.Context, o *cloudhub.Organization) error {
	if o.ID == string(DefaultOrganizationID) {
		return cloudhub.ErrCannotDeleteDefaultOrganization
	}
	_, err := s.get(ctx, o.ID)
	if err != nil {
		return err
	}
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(OrganizationsBucket).Delete([]byte(o.ID))
	}); err != nil {
		return err
	}

	// Dependent Delete of all resources

	// Each of the associated organization stores expects organization to be
	// set on the context.
	ctx = context.WithValue(ctx, organizations.ContextKey, o.ID)

	sourcesStore := organizations.NewSourcesStore(s.client.SourcesStore, o.ID)
	sources, err := sourcesStore.All(ctx)
	if err != nil {
		return err
	}
	for _, source := range sources {
		if err := sourcesStore.Delete(ctx, source); err != nil {
			return err
		}
	}

	serversStore := organizations.NewServersStore(s.client.ServersStore, o.ID)
	servers, err := serversStore.All(ctx)
	if err != nil {
		return err
	}
	for _, server := range servers {
		if err := serversStore.Delete(ctx, server); err != nil {
			return err
		}
	}

	dashboardsStore := organizations.NewDashboardsStore(s.client.DashboardsStore, o.ID)
	dashboards, err := dashboardsStore.All(ctx)
	if err != nil {
		return err
	}
	for _, dashboard := range dashboards {
		if err := dashboardsStore.Delete(ctx, dashboard); err != nil {
			return err
		}
	}

	usersStore := organizations.NewUsersStore(s.client.UsersStore, o.ID)
	users, err := usersStore.All(ctx)
	if err != nil {
		return err
	}
	for _, user := range users {
		if err := usersStore.Delete(ctx, &user); err != nil {
			return err
		}
	}

	mappings, err := s.client.MappingsStore.All(ctx)
	if err != nil {
		return err
	}
	for _, mapping := range mappings {
		if mapping.Organization == o.ID {
			if err := s.client.MappingsStore.Delete(ctx, &mapping); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *OrganizationsStore) get(ctx context.Context, id string) (*cloudhub.Organization, error) {
	var o cloudhub.Organization
	err := s.client.db.View(func(tx *bolt.Tx) error {
		v := tx.Bucket(OrganizationsBucket).Get([]byte(id))
		if v == nil {
			return cloudhub.ErrOrganizationNotFound
		}
		return internal.UnmarshalOrganization(v, &o)
	})

	if err != nil {
		return nil, err
	}

	return &o, nil
}

func (s *OrganizationsStore) each(ctx context.Context, fn func(*cloudhub.Organization)) error {
	return s.client.db.View(func(tx *bolt.Tx) error {
		return tx.Bucket(OrganizationsBucket).ForEach(func(k, v []byte) error {
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
func (s *OrganizationsStore) Get(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
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
	return nil, fmt.Errorf("must specify either ID, or Name in OrganizationQuery")
}

// Update the organization in OrganizationsStore
func (s *OrganizationsStore) Update(ctx context.Context, o *cloudhub.Organization) error {
	org, err := s.get(ctx, o.ID)
	if err != nil {
		return err
	}
	if o.Name != org.Name && !s.nameIsUnique(ctx, o.Name) {
		return cloudhub.ErrOrganizationAlreadyExists
	}
	return s.client.db.Update(func(tx *bolt.Tx) error {
		if v, err := internal.MarshalOrganization(o); err != nil {
			return err
		} else if err := tx.Bucket(OrganizationsBucket).Put([]byte(o.ID), v); err != nil {
			return err
		}
		return nil
	})
}
