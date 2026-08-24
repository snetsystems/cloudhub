package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OpenClawSkillStore = &OpenClawSkillStore{}

// OpenClawSkillStore is a facade on a cloudhub.OpenClawSkillStore that scopes
// every operation to one organization. It ignores the organization the caller
// passes and substitutes its own; that substitution, not the caller's good
// faith, is what keeps one organization out of another's skills.
type OpenClawSkillStore struct {
	store        cloudhub.OpenClawSkillStore
	organization string
}

// NewOpenClawSkillStore scopes a skill store to one organization.
func NewOpenClawSkillStore(s cloudhub.OpenClawSkillStore, org string) *OpenClawSkillStore {
	return &OpenClawSkillStore{store: s, organization: org}
}

// List returns the scoped organization's skills.
func (s *OpenClawSkillStore) List(ctx context.Context, organizationID string) ([]cloudhub.OpenClawSkill, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	return s.store.List(ctx, s.organization)
}

// Get returns one skill from the scoped organization.
func (s *OpenClawSkillStore) Get(ctx context.Context, organizationID, id string) (*cloudhub.OpenClawSkill, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	return s.store.Get(ctx, s.organization, id)
}

// Create stores a skill in the scoped organization. The skill's own
// organization field is rewritten too, so a value supplied in a request body
// cannot place a skill in a different organization.
func (s *OpenClawSkillStore) Create(ctx context.Context, skill *cloudhub.OpenClawSkill, rev *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkill, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	skill.OrganizationID = s.organization
	return s.store.Create(ctx, skill, rev)
}

// AddRevision appends a revision within the scoped organization.
func (s *OpenClawSkillStore) AddRevision(ctx context.Context, organizationID, skillID string, rev *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkillRevision, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	return s.store.AddRevision(ctx, s.organization, skillID, rev)
}

// Revisions lists revisions within the scoped organization.
func (s *OpenClawSkillStore) Revisions(ctx context.Context, organizationID, skillID string) ([]cloudhub.OpenClawSkillRevision, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	return s.store.Revisions(ctx, s.organization, skillID)
}

// Revision returns one revision within the scoped organization.
func (s *OpenClawSkillStore) Revision(ctx context.Context, organizationID, skillID string, revision int) (*cloudhub.OpenClawSkillRevision, error) {
	if err := validOrganization(ctx); err != nil {
		return nil, err
	}
	return s.store.Revision(ctx, s.organization, skillID, revision)
}

// UpdateRevisionReview records a review within the scoped organization.
func (s *OpenClawSkillStore) UpdateRevisionReview(ctx context.Context, organizationID, skillID string, revision int, review cloudhub.OpenClawSkillReview) error {
	if err := validOrganization(ctx); err != nil {
		return err
	}
	return s.store.UpdateRevisionReview(ctx, s.organization, skillID, revision, review)
}

// SetActiveRevision activates a revision within the scoped organization.
func (s *OpenClawSkillStore) SetActiveRevision(ctx context.Context, organizationID, skillID string, revision int) error {
	if err := validOrganization(ctx); err != nil {
		return err
	}
	return s.store.SetActiveRevision(ctx, s.organization, skillID, revision)
}

// Delete removes a skill within the scoped organization.
func (s *OpenClawSkillStore) Delete(ctx context.Context, organizationID, id string) error {
	if err := validOrganization(ctx); err != nil {
		return err
	}
	return s.store.Delete(ctx, s.organization, id)
}

// DeleteRevision removes one revision within the scoped organization.
func (s *OpenClawSkillStore) DeleteRevision(ctx context.Context, organizationID, skillID string, revision int) error {
	if err := validOrganization(ctx); err != nil {
		return err
	}
	return s.store.DeleteRevision(ctx, s.organization, skillID, revision)
}
