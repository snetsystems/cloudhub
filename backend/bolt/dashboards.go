package bolt

import (
	"context"
	"strconv"

	"github.com/boltdb/bolt"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/bolt/internal"
)

// Ensure DashboardsStore implements cmp.DashboardsStore.
var _ cmp.DashboardsStore = &DashboardsStore{}

// DashboardsBucket is the bolt bucket dashboards are stored in
var DashboardsBucket = []byte("Dashboard")

// DashboardsStore is the bolt implementation of storing dashboards
type DashboardsStore struct {
	client *Client
	IDs    cmp.ID
}

// AddIDs is a migration function that adds ID information to existing dashboards
func (d *DashboardsStore) AddIDs(ctx context.Context, boards []cmp.Dashboard) error {
	for _, board := range boards {
		update := false
		for i, cell := range board.Cells {
			// If there are is no id set, we generate one and update the dashboard
			if cell.ID == "" {
				id, err := d.IDs.Generate()
				if err != nil {
					return err
				}
				cell.ID = id
				board.Cells[i] = cell
				update = true
			}
		}
		if !update {
			continue
		}
		if err := d.Update(ctx, board); err != nil {
			return err
		}
	}
	return nil
}

// Migrate updates the dashboards at runtime
func (d *DashboardsStore) Migrate(ctx context.Context) error {
	// 1. Add UUIDs to cells without one
	boards, err := d.All(ctx)
	if err != nil {
		return err
	}
	if err := d.AddIDs(ctx, boards); err != nil {
		return nil
	}

	defaultOrg, err := d.client.OrganizationsStore.DefaultOrganization(ctx)
	if err != nil {
		return err
	}

	for _, board := range boards {
		if board.Organization == "" {
			board.Organization = defaultOrg.ID
			if err := d.Update(ctx, board); err != nil {
				return nil
			}
		}
	}

	return nil
}

// All returns all known dashboards
func (d *DashboardsStore) All(ctx context.Context) ([]cmp.Dashboard, error) {
	var srcs []cmp.Dashboard
	if err := d.client.db.View(func(tx *bolt.Tx) error {
		if err := tx.Bucket(DashboardsBucket).ForEach(func(k, v []byte) error {
			var src cmp.Dashboard
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

// Add creates a new Dashboard in the DashboardsStore
func (d *DashboardsStore) Add(ctx context.Context, src cmp.Dashboard) (cmp.Dashboard, error) {
	if err := d.client.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(DashboardsBucket)
		id, _ := b.NextSequence()

		src.ID = cmp.DashboardID(id)
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
		return cmp.Dashboard{}, err
	}

	return src, nil
}

// Get returns a Dashboard if the id exists.
func (d *DashboardsStore) Get(ctx context.Context, id cmp.DashboardID) (cmp.Dashboard, error) {
	var src cmp.Dashboard
	if err := d.client.db.View(func(tx *bolt.Tx) error {
		strID := strconv.Itoa(int(id))
		if v := tx.Bucket(DashboardsBucket).Get([]byte(strID)); v == nil {
			return cmp.ErrDashboardNotFound
		} else if err := internal.UnmarshalDashboard(v, &src); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cmp.Dashboard{}, err
	}

	return src, nil
}

// Delete the dashboard from DashboardsStore
func (d *DashboardsStore) Delete(ctx context.Context, dash cmp.Dashboard) error {
	if err := d.client.db.Update(func(tx *bolt.Tx) error {
		strID := strconv.Itoa(int(dash.ID))
		if err := tx.Bucket(DashboardsBucket).Delete([]byte(strID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Update the dashboard in DashboardsStore
func (d *DashboardsStore) Update(ctx context.Context, dash cmp.Dashboard) error {
	if err := d.client.db.Update(func(tx *bolt.Tx) error {
		// Get an existing dashboard with the same ID.
		b := tx.Bucket(DashboardsBucket)
		strID := strconv.Itoa(int(dash.ID))
		if v := b.Get([]byte(strID)); v == nil {
			return cmp.ErrDashboardNotFound
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
