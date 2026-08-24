package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OpenClawSkillStore = (*OpenClawSkillStore)(nil)

// OpenClawSkillStore is used when PostgreSQL is not configured. Reads report
// nothing rather than failing, so a deployment without PostgreSQL still serves
// an empty skill list; writes report that durable storage is unavailable
// rather than silently discarding an author's work.
type OpenClawSkillStore struct{}

// List reports no skills.
func (*OpenClawSkillStore) List(context.Context, string) ([]cloudhub.OpenClawSkill, error) {
	return []cloudhub.OpenClawSkill{}, nil
}

// Get reports that the skill does not exist.
func (*OpenClawSkillStore) Get(context.Context, string, string) (*cloudhub.OpenClawSkill, error) {
	return nil, cloudhub.ErrOpenClawSkillNotFound
}

// Create reports that durable storage is unavailable.
func (*OpenClawSkillStore) Create(context.Context, *cloudhub.OpenClawSkill, *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkill, error) {
	return nil, fmt.Errorf("no OpenClaw skill store configured")
}

// AddRevision reports that durable storage is unavailable.
func (*OpenClawSkillStore) AddRevision(context.Context, string, string, *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkillRevision, error) {
	return nil, fmt.Errorf("no OpenClaw skill store configured")
}

// Revisions reports no revisions.
func (*OpenClawSkillStore) Revisions(context.Context, string, string) ([]cloudhub.OpenClawSkillRevision, error) {
	return []cloudhub.OpenClawSkillRevision{}, nil
}

// Revision reports that the revision does not exist.
func (*OpenClawSkillStore) Revision(context.Context, string, string, int) (*cloudhub.OpenClawSkillRevision, error) {
	return nil, cloudhub.ErrOpenClawSkillNotFound
}

// UpdateRevisionReview reports that durable storage is unavailable.
func (*OpenClawSkillStore) UpdateRevisionReview(context.Context, string, string, int, cloudhub.OpenClawSkillReview) error {
	return fmt.Errorf("no OpenClaw skill store configured")
}

// SetActiveRevision reports that durable storage is unavailable.
func (*OpenClawSkillStore) SetActiveRevision(context.Context, string, string, int) error {
	return fmt.Errorf("no OpenClaw skill store configured")
}

// Delete reports that durable storage is unavailable.
func (*OpenClawSkillStore) Delete(context.Context, string, string) error {
	return fmt.Errorf("no OpenClaw skill store configured")
}

// DeleteRevision reports that durable storage is unavailable.
func (*OpenClawSkillStore) DeleteRevision(context.Context, string, string, int) error {
	return fmt.Errorf("no OpenClaw skill store configured")
}
