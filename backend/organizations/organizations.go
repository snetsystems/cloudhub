package organizations

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type contextKey string

// ContextKey is the key used to specify the
// organization via context
const ContextKey = contextKey("organization")

func validOrganization(ctx context.Context) error {
	// prevents panic in case of nil context
	if ctx == nil {
		return fmt.Errorf("expect non nil context")
	}
	orgID, ok := ctx.Value(ContextKey).(string)
	// should never happen
	if !ok {
		return fmt.Errorf("expected organization key to be a string")
	}
	if orgID == "" {
		return fmt.Errorf("expected organization key to be set")
	}
	return nil
}

// ensure that OrganizationsStore implements cloudhub.OrganizationStore
var _ cloudhub.OrganizationsStore = &OrganizationsStore{}

// OrganizationsStore facade on a OrganizationStore that filters organizations
// by organization.
type OrganizationsStore struct {
	store        cloudhub.OrganizationsStore
	organization string
}

// NewOrganizationsStore creates a new OrganizationsStore from an existing
// cloudhub.OrganizationStore and an organization string
func NewOrganizationsStore(s cloudhub.OrganizationsStore, org string) *OrganizationsStore {
	return &OrganizationsStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all organizations from the underlying OrganizationStore and filters them
// by organization.
func (s *OrganizationsStore) All(ctx context.Context) ([]cloudhub.Organization, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	ds, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	defaultOrg, err := s.store.DefaultOrganization(ctx)
	if err != nil {
		return nil, err
	}

	defaultOrgID := defaultOrg.ID

	// This filters organizations without allocating
	// https://github.com/golang/go/wiki/SliceTricks#filtering-without-allocating
	organizations := ds[:0]
	for _, d := range ds {
		id := d.ID
		switch id {
		case s.organization, defaultOrgID:
			organizations = append(organizations, d)
		default:
			continue
		}
	}

	return organizations, nil
}

// Add creates a new Organization in the OrganizationsStore with organization.Organization set to be the
// organization from the organization store.
func (s *OrganizationsStore) Add(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
	return nil, fmt.Errorf("cannot create organization")
}

// Delete the organization from OrganizationsStore
func (s *OrganizationsStore) Delete(ctx context.Context, o *cloudhub.Organization) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	o, err = s.store.Get(ctx, cloudhub.OrganizationQuery{ID: &o.ID})
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, o)
}

// Get returns a Organization if the id exists and belongs to the organization that is set.
func (s *OrganizationsStore) Get(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	d, err := s.store.Get(ctx, q)
	if err != nil {
		return nil, err
	}

	if d.ID != s.organization {
		return nil, cloudhub.ErrOrganizationNotFound
	}

	return d, nil
}

// Update the organization in OrganizationsStore.
func (s *OrganizationsStore) Update(ctx context.Context, o *cloudhub.Organization) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.OrganizationQuery{ID: &o.ID})
	if err != nil {
		return err
	}

	return s.store.Update(ctx, o)
}

// CreateDefault ...
func (s *OrganizationsStore) CreateDefault(ctx context.Context) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	return s.store.CreateDefault(ctx)
}

// DefaultOrganization ...
func (s *OrganizationsStore) DefaultOrganization(ctx context.Context) (*cloudhub.Organization, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	return s.store.DefaultOrganization(ctx)
}
