package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	platform "github.com/snetsystems/cloudhub/backend/v2"
)

var _ cloudhub.DashboardsStore = &DashboardsStore{}

// DashboardsStore mock allows all functions to be set for testing
type DashboardsStore struct {
	AddF    func(ctx context.Context, newDashboard cloudhub.Dashboard) (cloudhub.Dashboard, error)
	AllF    func(ctx context.Context) ([]cloudhub.Dashboard, error)
	DeleteF func(ctx context.Context, target cloudhub.Dashboard) error
	GetF    func(ctx context.Context, id cloudhub.DashboardID) (cloudhub.Dashboard, error)
	UpdateF func(ctx context.Context, target cloudhub.Dashboard) error
}

// Add ...
func (d *DashboardsStore) Add(ctx context.Context, newDashboard cloudhub.Dashboard) (cloudhub.Dashboard, error) {
	return d.AddF(ctx, newDashboard)
}

// All ...
func (d *DashboardsStore) All(ctx context.Context) ([]cloudhub.Dashboard, error) {
	return d.AllF(ctx)
}

// Delete ...
func (d *DashboardsStore) Delete(ctx context.Context, target cloudhub.Dashboard) error {
	return d.DeleteF(ctx, target)
}

// Get ...
func (d *DashboardsStore) Get(ctx context.Context, id cloudhub.DashboardID) (cloudhub.Dashboard, error) {
	return d.GetF(ctx, id)
}

// Update ...
func (d *DashboardsStore) Update(ctx context.Context, target cloudhub.Dashboard) error {
	return d.UpdateF(ctx, target)
}

var _ platform.DashboardService = &DashboardService{}

// DashboardService ...
type DashboardService struct {
	CreateDashboardF   func(context.Context, *platform.Dashboard) error
	FindDashboardByIDF func(context.Context, platform.ID) (*platform.Dashboard, error)
	FindDashboardsF    func(context.Context, platform.DashboardFilter) ([]*platform.Dashboard, int, error)
	UpdateDashboardF   func(context.Context, platform.ID, platform.DashboardUpdate) (*platform.Dashboard, error)
	DeleteDashboardF   func(context.Context, platform.ID) error
}

// FindDashboardByID ...
func (s *DashboardService) FindDashboardByID(ctx context.Context, id platform.ID) (*platform.Dashboard, error) {
	return s.FindDashboardByIDF(ctx, id)
}

// FindDashboards ...
func (s *DashboardService) FindDashboards(ctx context.Context, filter platform.DashboardFilter) ([]*platform.Dashboard, int, error) {
	return s.FindDashboardsF(ctx, filter)
}

// CreateDashboard ...
func (s *DashboardService) CreateDashboard(ctx context.Context, b *platform.Dashboard) error {
	return s.CreateDashboardF(ctx, b)
}

// UpdateDashboard ...
func (s *DashboardService) UpdateDashboard(ctx context.Context, id platform.ID, upd platform.DashboardUpdate) (*platform.Dashboard, error) {
	return s.UpdateDashboardF(ctx, id, upd)
}

// DeleteDashboard ...
func (s *DashboardService) DeleteDashboard(ctx context.Context, id platform.ID) error {
	return s.DeleteDashboardF(ctx, id)
}
