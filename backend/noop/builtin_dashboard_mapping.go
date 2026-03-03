package noop

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure FixedCellMappingStore implements cloudhub.FixedCellMappingStore.
var _ cloudhub.FixedCellMappingStore = (*FixedCellMappingStore)(nil)

// FixedCellMappingStore is a no-op implementation.
type FixedCellMappingStore struct{}

// GetDashboardID returns ErrDashboardNotFound.
func (s *FixedCellMappingStore) GetDashboardID(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error) {
	return 0, cloudhub.ErrDashboardNotFound
}

// Register is a no-op.
func (s *FixedCellMappingStore) Register(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error {
	return nil
}

// Unregister is a no-op.
func (s *FixedCellMappingStore) Unregister(ctx context.Context, orgID, name string) error {
	return nil
}

// ListByTemplateName returns nil (no mappings).
func (s *FixedCellMappingStore) ListByTemplateName(ctx context.Context, name string) ([]cloudhub.FixedCellMappingEntry, error) {
	return nil, nil
}
