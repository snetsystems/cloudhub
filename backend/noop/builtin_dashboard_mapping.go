package noop

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure BuiltinDashboardMappingStore implements cloudhub.BuiltinDashboardMappingStore.
var _ cloudhub.BuiltinDashboardMappingStore = (*BuiltinDashboardMappingStore)(nil)

// BuiltinDashboardMappingStore is a no-op implementation.
type BuiltinDashboardMappingStore struct{}

// GetDashboardID returns ErrDashboardNotFound.
func (s *BuiltinDashboardMappingStore) GetDashboardID(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error) {
	return 0, cloudhub.ErrDashboardNotFound
}

// Register is a no-op.
func (s *BuiltinDashboardMappingStore) Register(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error {
	return nil
}

// ListByBuiltinName returns nil (no mappings).
func (s *BuiltinDashboardMappingStore) ListByBuiltinName(ctx context.Context, name string) ([]cloudhub.BuiltinDashboardMappingEntry, error) {
	return nil, nil
}
