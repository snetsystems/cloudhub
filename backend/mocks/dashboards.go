package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
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
