package organizations

import (
	"context"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that OpenClawSessionStore implements cloudhub.OpenClawSessionStore
var _ cloudhub.OpenClawSessionStore = &OpenClawSessionStore{}

// OpenClawSessionStore facade on an OpenClawSessionStore that filters
// sessions by organization.
type OpenClawSessionStore struct {
	store        cloudhub.OpenClawSessionStore
	organization string
}

// NewOpenClawSessionStore creates a new OpenClawSessionStore from an
// existing cloudhub.OpenClawSessionStore and an organization string
func NewOpenClawSessionStore(s cloudhub.OpenClawSessionStore, org string) *OpenClawSessionStore {
	return &OpenClawSessionStore{
		store:        s,
		organization: org,
	}
}

// Create stores a session with session.OrganizationID set to be the
// organization from the session store.
func (s *OpenClawSessionStore) Create(ctx context.Context, session *cloudhub.OpenClawSession) (*cloudhub.OpenClawSession, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	scoped := *session
	scoped.OrganizationID = s.organization
	return s.store.Create(ctx, &scoped)
}

// Get returns a session if the id exists and belongs to the organization
// that is set.
func (s *OpenClawSessionStore) Get(ctx context.Context, id string) (*cloudhub.OpenClawSession, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	session, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	// A store with no durable backing reports a miss as a nil session
	// rather than an error.
	if session == nil {
		return nil, nil
	}

	if session.OrganizationID != s.organization {
		return nil, cloudhub.ErrOpenClawSessionNotFound
	}

	return session, nil
}

// List retrieves the sessions of the organization that is set, ignoring the
// organization the caller asked for.
func (s *OpenClawSessionStore) List(ctx context.Context, organizationID string) ([]cloudhub.OpenClawSession, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	return s.store.List(ctx, s.organization)
}

// Touch records new activity on a session belonging to the organization
// that is set.
func (s *OpenClawSessionStore) Touch(ctx context.Context, id string, updatedAt time.Time) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	session, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	if session == nil {
		return cloudhub.ErrOpenClawSessionNotFound
	}

	return s.store.Touch(ctx, id, updatedAt)
}
