package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure BuiltinDashboardMappingStore implements cloudhub.BuiltinDashboardMappingStore.
var _ cloudhub.BuiltinDashboardMappingStore = (*BuiltinDashboardMappingStore)(nil)

// BuiltinDashboardMappingStore mock.
type BuiltinDashboardMappingStore struct {
	GetDashboardIDF    func(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error)
	RegisterF          func(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error
	ListByBuiltinNameF func(ctx context.Context, name string) ([]cloudhub.BuiltinDashboardMappingEntry, error)
}

// GetDashboardID calls GetDashboardIDF if set.
func (s *BuiltinDashboardMappingStore) GetDashboardID(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error) {
	if s.GetDashboardIDF != nil {
		return s.GetDashboardIDF(ctx, orgID, name)
	}
	return 0, cloudhub.ErrDashboardNotFound
}

// Register calls RegisterF if set.
func (s *BuiltinDashboardMappingStore) Register(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error {
	if s.RegisterF != nil {
		return s.RegisterF(ctx, orgID, name, dashboardID)
	}
	return nil
}

// ListByBuiltinName calls ListByBuiltinNameF if set.
func (s *BuiltinDashboardMappingStore) ListByBuiltinName(ctx context.Context, name string) ([]cloudhub.BuiltinDashboardMappingEntry, error) {
	if s.ListByBuiltinNameF != nil {
		return s.ListByBuiltinNameF(ctx, name)
	}
	return nil, nil
}
