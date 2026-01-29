package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.DashboardItemsStore = &DashboardItemsStore{}

// DashboardItemsStore is a mock implementation of cloudhub.DashboardItemsStore
type DashboardItemsStore struct {
	AllFunc    func(ctx context.Context) ([]cloudhub.DashboardItem, error)
	AddFunc    func(ctx context.Context, item cloudhub.DashboardItem) (cloudhub.DashboardItem, error)
	GetFunc    func(ctx context.Context, id string) (cloudhub.DashboardItem, error)
	DeleteFunc func(ctx context.Context, item cloudhub.DashboardItem) error
	UpdateFunc func(ctx context.Context, item cloudhub.DashboardItem) error
}

// All mocks the All method
func (s *DashboardItemsStore) All(ctx context.Context) ([]cloudhub.DashboardItem, error) {
	return s.AllFunc(ctx)
}

// Add mocks the Add method
func (s *DashboardItemsStore) Add(ctx context.Context, item cloudhub.DashboardItem) (cloudhub.DashboardItem, error) {
	return s.AddFunc(ctx, item)
}

// Get mocks the Get method
func (s *DashboardItemsStore) Get(ctx context.Context, id string) (cloudhub.DashboardItem, error) {
	return s.GetFunc(ctx, id)
}

// Delete mocks the Delete method
func (s *DashboardItemsStore) Delete(ctx context.Context, item cloudhub.DashboardItem) error {
	return s.DeleteFunc(ctx, item)
}

// Update mocks the Update method
func (s *DashboardItemsStore) Update(ctx context.Context, item cloudhub.DashboardItem) error {
	return s.UpdateFunc(ctx, item)
}
