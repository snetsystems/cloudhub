package kv

import (
	"context"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure dashboardsStore implements cloudhub.DashboardsStore.
var _ cloudhub.DashboardsStore = &dashboardsStore{}

// dashboardsStore is the bolt implementation of storing dashboards
type dashboardsStore struct {
	client *Service
	IDs    cloudhub.ID
}

// All returns all known dashboards
func (d *dashboardsStore) All(ctx context.Context) ([]cloudhub.Dashboard, error) {
	var srcs []cloudhub.Dashboard
	if err := d.client.kv.View(ctx, func(tx Tx) error {
		if err := tx.Bucket(dashboardsBucket).ForEach(func(k, v []byte) error {
			var src cloudhub.Dashboard
			if err := internal.UnmarshalDashboard(v, &src); err != nil {
				return err
			}
			srcs = append(srcs, src)
			return nil
		}); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return srcs, nil
}

// Add creates a new Dashboard in the dashboardsStore
func (d *dashboardsStore) Add(ctx context.Context, src cloudhub.Dashboard) (cloudhub.Dashboard, error) {
	if err := d.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(dashboardsBucket)
		id, _ := b.NextSequence()

		src.ID = cloudhub.DashboardID(id)
		// TODO: use FormatInt
		strID := strconv.Itoa(int(id))
		for i, cell := range src.Cells {
			cid, err := d.IDs.Generate()
			if err != nil {
				return err
			}
			cell.ID = cid
			src.Cells[i] = cell
		}
		v, err := internal.MarshalDashboard(src)
		if err != nil {
			return err
		}
		return b.Put([]byte(strID), v)
	}); err != nil {
		return cloudhub.Dashboard{}, err
	}

	return src, nil
}

// Get returns a Dashboard if the id exists.
func (d *dashboardsStore) Get(ctx context.Context, id cloudhub.DashboardID) (cloudhub.Dashboard, error) {
	var src cloudhub.Dashboard
	if err := d.client.kv.View(ctx, func(tx Tx) error {
		strID := strconv.Itoa(int(id))
		if v, err := tx.Bucket(dashboardsBucket).Get([]byte(strID)); v == nil || err != nil {
			return cloudhub.ErrDashboardNotFound
		} else if err := internal.UnmarshalDashboard(v, &src); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cloudhub.Dashboard{}, err
	}

	return src, nil
}

// Delete the dashboard from dashboardsStore
func (d *dashboardsStore) Delete(ctx context.Context, dash cloudhub.Dashboard) error {
	return d.client.kv.Update(ctx, func(tx Tx) error {
		return tx.Bucket(dashboardsBucket).Delete([]byte(strconv.Itoa(int(dash.ID))))
	})
}

// Update the dashboard in dashboardsStore
func (d *dashboardsStore) Update(ctx context.Context, dash cloudhub.Dashboard) error {
	if err := d.client.kv.Update(ctx, func(tx Tx) error {
		// Get an existing dashboard with the same ID.
		b := tx.Bucket(dashboardsBucket)
		strID := strconv.Itoa(int(dash.ID))
		if v, err := b.Get([]byte(strID)); v == nil || err != nil {
			return cloudhub.ErrDashboardNotFound
		}

		for i, cell := range dash.Cells {
			if cell.ID != "" {
				continue
			}
			cid, err := d.IDs.Generate()
			if err != nil {
				return err
			}
			cell.ID = cid
			dash.Cells[i] = cell
		}
		if v, err := internal.MarshalDashboard(dash); err != nil {
			return err
		} else if err := b.Put([]byte(strID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}
