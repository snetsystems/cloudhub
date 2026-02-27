package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure FixedCellMappingStore implements cloudhub.FixedCellMappingStore.
var _ cloudhub.FixedCellMappingStore = (*FixedCellMappingStore)(nil)

// FixedCellMappingStore mock.
type FixedCellMappingStore struct {
	GetDashboardIDF   func(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error)
	RegisterF        func(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error
	ListByTemplateNameF func(ctx context.Context, name string) ([]cloudhub.FixedCellMappingEntry, error)
}

// GetDashboardID calls GetDashboardIDF if set.
func (s *FixedCellMappingStore) GetDashboardID(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error) {
	if s.GetDashboardIDF != nil {
		return s.GetDashboardIDF(ctx, orgID, name)
	}
	return 0, cloudhub.ErrDashboardNotFound
}

// Register calls RegisterF if set.
func (s *FixedCellMappingStore) Register(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error {
	if s.RegisterF != nil {
		return s.RegisterF(ctx, orgID, name, dashboardID)
	}
	return nil
}

// ListByTemplateName calls ListByTemplateNameF if set.
func (s *FixedCellMappingStore) ListByTemplateName(ctx context.Context, name string) ([]cloudhub.FixedCellMappingEntry, error) {
	if s.ListByTemplateNameF != nil {
		return s.ListByTemplateNameF(ctx, name)
	}
	return nil, nil
}
