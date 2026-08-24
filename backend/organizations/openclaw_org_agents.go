package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OpenClawOrgAgentStore = &OpenClawOrgAgentStore{}

// OpenClawOrgAgentStore scopes agent mapping lookups to one organization,
// ignoring the organization the caller passes.
type OpenClawOrgAgentStore struct {
	store        cloudhub.OpenClawOrgAgentStore
	organization string
}

// NewOpenClawOrgAgentStore scopes an org agent store to one organization.
func NewOpenClawOrgAgentStore(s cloudhub.OpenClawOrgAgentStore, org string) *OpenClawOrgAgentStore {
	return &OpenClawOrgAgentStore{store: s, organization: org}
}

// Get returns the scoped organization's agent for a purpose.
func (s *OpenClawOrgAgentStore) Get(ctx context.Context, organizationID, purpose string) (string, error) {
	if err := validOrganization(ctx); err != nil {
		return "", err
	}
	return s.store.Get(ctx, s.organization, purpose)
}

// Ensure binds an agent to a purpose for the scoped organization if nothing is
// bound yet.
func (s *OpenClawOrgAgentStore) Ensure(ctx context.Context, organizationID, purpose, agentID string) (string, error) {
	if err := validOrganization(ctx); err != nil {
		return "", err
	}
	return s.store.Ensure(ctx, s.organization, purpose, agentID)
}

// All returns the scoped organization's live mappings.
func (s *OpenClawOrgAgentStore) All(ctx context.Context, organizationID string) (map[string]string, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	return s.store.All(ctx, s.organization)
}

// SoftDelete retires the scoped organization's mappings.
func (s *OpenClawOrgAgentStore) SoftDelete(ctx context.Context, organizationID string) error {
	if err := validOrganization(ctx); err != nil {
		return err
	}
	return s.store.SoftDelete(ctx, s.organization)
}

// PendingReclaim returns only the scoped organization's leftovers. The
// underlying store spans every organization, and handing a member another
// organization's agent ids would leak the mapping this wrapper exists to hide.
func (s *OpenClawOrgAgentStore) PendingReclaim(ctx context.Context) ([]cloudhub.OpenClawPendingReclaim, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	all, err := s.store.PendingReclaim(ctx)
	if err != nil {
		return nil, err
	}
	pending := []cloudhub.OpenClawPendingReclaim{}
	for _, entry := range all {
		if entry.OrganizationID == s.organization {
			pending = append(pending, entry)
		}
	}
	return pending, nil
}

// MarkReclaimed records a reclaimed workspace for the scoped organization.
func (s *OpenClawOrgAgentStore) MarkReclaimed(ctx context.Context, organizationID, purpose string) error {
	if err := validOrganization(ctx); err != nil {
		return err
	}
	return s.store.MarkReclaimed(ctx, s.organization, purpose)
}

// Replace swaps the scoped organization's mapping.
func (s *OpenClawOrgAgentStore) Replace(ctx context.Context, organizationID string, agents map[string]string) error {
	if err := validOrganization(ctx); err != nil {
		return err
	}
	return s.store.Replace(ctx, s.organization, agents)
}
