package kv

import (
	"context"
	"encoding/json"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure dashboardItemsStore implements cloudhub.DashboardItemsStore
var _ cloudhub.DashboardItemsStore = &dashboardItemsStore{}

// dashboardItemsStore is the bolt implementation
type dashboardItemsStore struct {
	client *Service
	IDs    cloudhub.ID
}

// All lists all items
func (s *dashboardItemsStore) All(ctx context.Context) ([]cloudhub.DashboardItem, error) {
	var items []cloudhub.DashboardItem
	err := s.client.kv.View(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardItemsBucket)
		return b.ForEach(func(k, v []byte) error {
			var d cloudhub.DashboardItem
			if err := json.Unmarshal(v, &d); err != nil {
				return err
			}
			items = append(items, d)
			return nil
		})
	})
	return items, err
}

// Add creates a new item
func (s *dashboardItemsStore) Add(ctx context.Context, item cloudhub.DashboardItem) (cloudhub.DashboardItem, error) {
	err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardItemsBucket)

		// Generate ID if not provided
		if item.ID == "" {
			id, err := s.IDs.Generate()
			if err != nil {
				return err
			}
			item.ID = id
		}

		v, err := json.Marshal(item)
		if err != nil {
			return err
		}
		return b.Put([]byte(item.ID), v)
	})
	if err != nil {
		return cloudhub.DashboardItem{}, err
	}
	return item, nil
}

// Get retrieves an item
func (s *dashboardItemsStore) Get(ctx context.Context, id string) (cloudhub.DashboardItem, error) {
	var item cloudhub.DashboardItem
	err := s.client.kv.View(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardItemsBucket)
		v, err := b.Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrDashboardItemNotFound
		}
		return json.Unmarshal(v, &item)
	})
	if err != nil {
		return cloudhub.DashboardItem{}, err
	}
	return item, nil
}

// Delete removes an item
func (s *dashboardItemsStore) Delete(ctx context.Context, item cloudhub.DashboardItem) error {
	return s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardItemsBucket)
		return b.Delete([]byte(item.ID))
	})
}

// Update updates an item
func (s *dashboardItemsStore) Update(ctx context.Context, item cloudhub.DashboardItem) error {
	return s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardItemsBucket)

		// Check existence
		if v, err := b.Get([]byte(item.ID)); v == nil || err != nil {
			return cloudhub.ErrDashboardItemNotFound
		}

		v, err := json.Marshal(item)
		if err != nil {
			return err
		}
		return b.Put([]byte(item.ID), v)
	})
}
