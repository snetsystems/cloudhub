package kv

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure dashboardItemsStore implements cloudhub.DashboardItemsStore.
var _ cloudhub.DashboardItemsStore = &dashboardItemsStore{}

// dashboardItemsStore is the bolt implementation of storing dashboard items
type dashboardItemsStore struct {
	client *Service
	IDs    cloudhub.ID
}

// All returns all known dashboard items
func (s *dashboardItemsStore) All(ctx context.Context) ([]cloudhub.DashboardItem, error) {
	var items []cloudhub.DashboardItem
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(dashboardItemsBucket).ForEach(func(k, v []byte) error {
			var item cloudhub.DashboardItem
			if err := internal.UnmarshalDashboardItem(v, &item); err != nil {
				return err
			}
			items = append(items, item)
			return nil
		})
	}); err != nil {
		return nil, err
	}

	return items, nil
}

// Add creates a new DashboardItem in the dashboardItemsStore
func (s *dashboardItemsStore) Add(ctx context.Context, item cloudhub.DashboardItem) (cloudhub.DashboardItem, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardItemsBucket)

		// Generate unique ID
		id, err := s.IDs.Generate()
		if err != nil {
			return err
		}
		item.ID = id

		v, err := internal.MarshalDashboardItem(item)
		if err != nil {
			return err
		}
		return b.Put([]byte(id), v)
	}); err != nil {
		return cloudhub.DashboardItem{}, err
	}

	return item, nil
}

// Get returns a DashboardItem if the id exists.
func (s *dashboardItemsStore) Get(ctx context.Context, id string) (cloudhub.DashboardItem, error) {
	var item cloudhub.DashboardItem
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(dashboardItemsBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrDashboardItemNotFound
		}
		return internal.UnmarshalDashboardItem(v, &item)
	}); err != nil {
		return cloudhub.DashboardItem{}, err
	}

	return item, nil
}

// Delete the dashboard item from dashboardItemsStore
func (s *dashboardItemsStore) Delete(ctx context.Context, item cloudhub.DashboardItem) error {
	return s.client.kv.Update(ctx, func(tx Tx) error {
		return tx.Bucket(dashboardItemsBucket).Delete([]byte(item.ID))
	})
}

// Update the dashboard item in dashboardItemsStore
func (s *dashboardItemsStore) Update(ctx context.Context, item cloudhub.DashboardItem) error {
	return s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardItemsBucket)

		// Check if item exists
		if v, err := b.Get([]byte(item.ID)); v == nil || err != nil {
			return cloudhub.ErrDashboardItemNotFound
		}

		v, err := internal.MarshalDashboardItem(item)
		if err != nil {
			return err
		}
		return b.Put([]byte(item.ID), v)
	})
}
