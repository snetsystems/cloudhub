package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure DashboardsStore implements cloudhub.DashboardsStore
var _ cloudhub.DashboardsStore = &DashboardsStore{}

// DashboardsStore ...
type DashboardsStore struct{}

// All ...
func (s *DashboardsStore) All(context.Context) ([]cloudhub.Dashboard, error) {
	return nil, fmt.Errorf("no dashboards found")
}

// Add ...
func (s *DashboardsStore) Add(context.Context, cloudhub.Dashboard) (cloudhub.Dashboard, error) {
	return cloudhub.Dashboard{}, fmt.Errorf("failed to add dashboard")
}

// Delete ...
func (s *DashboardsStore) Delete(context.Context, cloudhub.Dashboard) error {
	return fmt.Errorf("failed to delete dashboard")
}

// Get ...
func (s *DashboardsStore) Get(ctx context.Context, ID cloudhub.DashboardID) (cloudhub.Dashboard, error) {
	return cloudhub.Dashboard{}, cloudhub.ErrDashboardNotFound
}

// Update ...
func (s *DashboardsStore) Update(context.Context, cloudhub.Dashboard) error {
	return fmt.Errorf("failed to update dashboard")
}
