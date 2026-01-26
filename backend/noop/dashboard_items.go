package noop

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.DashboardItemsStore = &DashboardItemsStore{}

// DashboardItemsStore is a no-op implementation of cloudhub.DashboardItemsStore
type DashboardItemsStore struct{}

// All is a no-op.
func (s *DashboardItemsStore) All(ctx context.Context) ([]cloudhub.DashboardItem, error) {
	return nil, nil
}

// Add is a no-op.
func (s *DashboardItemsStore) Add(ctx context.Context, item cloudhub.DashboardItem) (cloudhub.DashboardItem, error) {
	return cloudhub.DashboardItem{}, nil
}

// Get is a no-op.
func (s *DashboardItemsStore) Get(ctx context.Context, id string) (cloudhub.DashboardItem, error) {
	return cloudhub.DashboardItem{}, cloudhub.ErrDashboardItemNotFound
}

// Delete is a no-op.
func (s *DashboardItemsStore) Delete(ctx context.Context, item cloudhub.DashboardItem) error {
	return nil
}

// Update is a no-op.
func (s *DashboardItemsStore) Update(ctx context.Context, item cloudhub.DashboardItem) error {
	return nil
}
