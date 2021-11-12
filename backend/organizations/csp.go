package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that CSPStore implements cloudhub.CSPStore
var _ cloudhub.CSPStore = &CSPStore{}

// CSPStore facade on a CSPStore that filters CSP
// by organization.
type CSPStore struct {
	store        cloudhub.CSPStore
	organization string
}

// NewCSPStore creates a new CSPStore from an existing
// cloudhub.CSPStore and an organization string
func NewCSPStore(s cloudhub.CSPStore, org string) *CSPStore {
	return &CSPStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all CSPs from the underlying CSPStore and filters them
// by organization.
func (s *CSPStore) All(ctx context.Context) ([]cloudhub.CSP, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	allCSP, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	csps := allCSP[:0]
	for _, d := range allCSP {
		if d.Organization == s.organization {
			csps = append(csps, d)
		}
	}

	return csps, nil
}

// Get returns a CSP if the id exists and belongs to the organization that is set.
func (s *CSPStore) Get(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	q.Organization = &s.organization

	t, err := s.store.Get(ctx, q)
	if err != nil {
		return nil, err
	}

	if t.Organization != s.organization {
		return nil, cloudhub.ErrCSPNotFound
	}

	return t, nil
}

// Add creates a new CSP in the CSPStore with CSP.Organization set to be the
// organization from the CSP store.
func (s *CSPStore) Add(ctx context.Context, t *cloudhub.CSP) (*cloudhub.CSP, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	t.Organization = s.organization

	return s.store.Add(ctx, t)
}

// Delete the CSP from CSPStore
func (s *CSPStore) Delete(ctx context.Context, t *cloudhub.CSP) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.CSPQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, t)
}

// Update the CSP in CSPStore.
func (s *CSPStore) Update(ctx context.Context, t *cloudhub.CSP) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	_, err = s.store.Get(ctx, cloudhub.CSPQuery{ID: &t.ID})
	if err != nil {
		return err
	}

	return s.store.Update(ctx, t)
}
