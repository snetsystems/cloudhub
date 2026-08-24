package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OpenClawOrgAgentStore = (*OpenClawOrgAgentStore)(nil)

// OpenClawOrgAgentStore is used when PostgreSQL is not configured.
type OpenClawOrgAgentStore struct{}

// Get reports that no agent is mapped.
func (*OpenClawOrgAgentStore) Get(context.Context, string, string) (string, error) {
	return "", cloudhub.ErrOpenClawAgentNotMapped
}

// Ensure reports that durable storage is unavailable.
func (*OpenClawOrgAgentStore) Ensure(context.Context, string, string, string) (string, error) {
	return "", fmt.Errorf("no OpenClaw org agent store configured")
}

// All reports that nothing is mapped.
func (*OpenClawOrgAgentStore) All(context.Context, string) (map[string]string, error) {
	return map[string]string{}, nil
}

// SoftDelete reports that durable storage is unavailable.
func (*OpenClawOrgAgentStore) SoftDelete(context.Context, string) error {
	return fmt.Errorf("no OpenClaw org agent store configured")
}

// PendingReclaim reports that nothing is awaiting reclaim.
func (*OpenClawOrgAgentStore) PendingReclaim(context.Context) ([]cloudhub.OpenClawPendingReclaim, error) {
	return []cloudhub.OpenClawPendingReclaim{}, nil
}

// MarkReclaimed reports that durable storage is unavailable.
func (*OpenClawOrgAgentStore) MarkReclaimed(context.Context, string, string) error {
	return fmt.Errorf("no OpenClaw org agent store configured")
}

// Replace reports that durable storage is unavailable.
func (*OpenClawOrgAgentStore) Replace(context.Context, string, map[string]string) error {
	return fmt.Errorf("no OpenClaw org agent store configured")
}
