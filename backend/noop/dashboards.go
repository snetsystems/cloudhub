package noop

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// ensure DashboardsStore implements cmp.DashboardsStore
var _ cmp.DashboardsStore = &DashboardsStore{}

// DashboardsStore ...
type DashboardsStore struct{}

// All ...
func (s *DashboardsStore) All(context.Context) ([]cmp.Dashboard, error) {
	return nil, fmt.Errorf("no dashboards found")
}

// Add ...
func (s *DashboardsStore) Add(context.Context, cmp.Dashboard) (cmp.Dashboard, error) {
	return cmp.Dashboard{}, fmt.Errorf("failed to add dashboard")
}

// Delete ...
func (s *DashboardsStore) Delete(context.Context, cmp.Dashboard) error {
	return fmt.Errorf("failed to delete dashboard")
}

// Get ...
func (s *DashboardsStore) Get(ctx context.Context, ID cmp.DashboardID) (cmp.Dashboard, error) {
	return cmp.Dashboard{}, cmp.ErrDashboardNotFound
}

// Update ...
func (s *DashboardsStore) Update(context.Context, cmp.Dashboard) error {
	return fmt.Errorf("failed to update dashboard")
}
