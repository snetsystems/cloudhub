package organizations

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that DashboardItemsStore implements cloudhub.DashboardItemsStore
var _ cloudhub.DashboardItemsStore = &DashboardItemsStore{}

// DashboardItemsStore facade on a DashboardItemsStore that filters dashboard items
// by organization.
type DashboardItemsStore struct {
	store        cloudhub.DashboardItemsStore
	organization string
}

// NewDashboardItemsStore creates a new DashboardItemsStore from an existing
// cloudhub.DashboardItemsStore and an organization string
func NewDashboardItemsStore(s cloudhub.DashboardItemsStore, org string) *DashboardItemsStore {
	return &DashboardItemsStore{
		store:        s,
		organization: org,
	}
}

// All retrieves all dashboard items from the underlying DashboardItemsStore and filters them
// by organization.
func (s *DashboardItemsStore) All(ctx context.Context) ([]cloudhub.DashboardItem, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	items, err := s.store.All(ctx)
	if err != nil {
		return nil, err
	}

	// Filter items by organization
	filtered := items[:0]
	for _, item := range items {
		if item.Organization == s.organization {
			filtered = append(filtered, item)
		}
	}

	return filtered, nil
}

// Add creates a new DashboardItem in the DashboardItemsStore with item.Organization set to be the
// organization from the dashboard items store.
func (s *DashboardItemsStore) Add(ctx context.Context, item cloudhub.DashboardItem) (cloudhub.DashboardItem, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.DashboardItem{}, err
	}

	item.Organization = s.organization
	return s.store.Add(ctx, item)
}

// Delete the dashboard item from DashboardItemsStore
func (s *DashboardItemsStore) Delete(ctx context.Context, item cloudhub.DashboardItem) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	existing, err := s.store.Get(ctx, item.ID)
	if err != nil {
		return err
	}

	if existing.Organization != s.organization {
		return cloudhub.ErrDashboardItemNotFound
	}

	return s.store.Delete(ctx, item)
}

// Get returns a DashboardItem if the id exists and belongs to the organization that is set.
func (s *DashboardItemsStore) Get(ctx context.Context, id string) (cloudhub.DashboardItem, error) {
	err := validOrganization(ctx)
	if err != nil {
		return cloudhub.DashboardItem{}, err
	}

	item, err := s.store.Get(ctx, id)
	if err != nil {
		return cloudhub.DashboardItem{}, err
	}

	if item.Organization != s.organization {
		return cloudhub.DashboardItem{}, cloudhub.ErrDashboardItemNotFound
	}

	return item, nil
}

// Update the dashboard item in DashboardItemsStore.
func (s *DashboardItemsStore) Update(ctx context.Context, item cloudhub.DashboardItem) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	existing, err := s.store.Get(ctx, item.ID)
	if err != nil {
		return err
	}

	if existing.Organization != s.organization {
		return cloudhub.ErrDashboardItemNotFound
	}

	return s.store.Update(ctx, item)
}
