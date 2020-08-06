package filestore

import (
	"context"
	"errors"
	"io/ioutil"
	"os"
	"path"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// DashExt is the the file extension searched for in the directory for dashboard files
const DashExt = ".dashboard"

// Verify dashboards implements dashboardsStore interface.
var _ cloudhub.DashboardsStore = (*Dashboards)(nil)

// Dashboards are JSON dashboards stored in the filesystem
type Dashboards struct {
	Dir     string                                      // Dir is the directory containing the dashboards.
	ReadDir func(dirname string) ([]os.FileInfo, error) // ReadDir reads the directory named by dirname and returns a list of directory entries sorted by filename.
	Remove  func(name string) error                     // Remove file
	IDs     cloudhub.ID                                      // IDs generate unique ids for new dashboards
	Logger  cloudhub.Logger
}

// NewDashboards constructs a dashboard store wrapping a file system directory
func NewDashboards(dir string, ids cloudhub.ID, logger cloudhub.Logger) cloudhub.DashboardsStore {
	return &Dashboards{
		Dir:     dir,
		ReadDir: ioutil.ReadDir,
		Remove:  os.Remove,
		IDs:     ids,
		Logger:  logger,
	}
}

// All returns all dashboards from the directory
func (d *Dashboards) All(ctx context.Context) ([]cloudhub.Dashboard, error) {
	files, err := d.ReadDir(d.Dir)
	if err != nil {
		return nil, err
	}

	dashboards := []cloudhub.Dashboard{}
	for _, file := range files {
		if path.Ext(file.Name()) != DashExt {
			continue
		}
		var dashboard cloudhub.Dashboard
		if err := load(path.Join(d.Dir, file.Name()), &dashboard); err != nil {
			continue // We want to load all files we can.
		} else {
			dashboards = append(dashboards, dashboard)
		}
	}
	return dashboards, nil
}

// Get returns a dashboard file from the dashboard directory
func (d *Dashboards) Get(ctx context.Context, id cloudhub.DashboardID) (cloudhub.Dashboard, error) {
	board, file, err := d.idToFile(id)
	if err != nil {
		if err == cloudhub.ErrDashboardNotFound {
			d.Logger.
				WithField("component", "dashboard").
				WithField("name", file).
				Error("Unable to read file")
		} else if err == cloudhub.ErrDashboardInvalid {
			d.Logger.
				WithField("component", "dashboard").
				WithField("name", file).
				Error("File is not a dashboard")
		}
		return cloudhub.Dashboard{}, err
	}
	return board, nil
}

// idToFile takes an id and finds the associated filename
func (d *Dashboards) idToFile(id cloudhub.DashboardID) (cloudhub.Dashboard, string, error) {
	// Because the entire dashboard information is not known at this point, we need
	// to try to find the name of the file through matching the ID in the dashboard
	// content with the ID passed.
	files, err := d.ReadDir(d.Dir)
	if err != nil {
		return cloudhub.Dashboard{}, "", err
	}

	for _, f := range files {
		if path.Ext(f.Name()) != DashExt {
			continue
		}
		file := path.Join(d.Dir, f.Name())
		var dashboard cloudhub.Dashboard
		if err := load(file, &dashboard); err != nil {
			return cloudhub.Dashboard{}, "", err
		}
		if dashboard.ID == id {
			return dashboard, file, nil
		}
	}

	return cloudhub.Dashboard{}, "", cloudhub.ErrDashboardNotFound
}

// Update replaces a dashboard from the file system directory
func (d *Dashboards) Update(ctx context.Context, dashboard cloudhub.Dashboard) error {
	board, _, err := d.idToFile(dashboard.ID)
	if err != nil {
		return err
	}

	if err := d.Delete(ctx, board); err != nil {
		return err
	}
	file := file(d.Dir, dashboard.Name, DashExt)
	return create(file, dashboard)
}

// Delete removes a dashboard file from the directory
func (d *Dashboards) Delete(ctx context.Context, dashboard cloudhub.Dashboard) error {
	_, file, err := d.idToFile(dashboard.ID)
	if err != nil {
		return err
	}

	if err := d.Remove(file); err != nil {
		d.Logger.
			WithField("component", "dashboard").
			WithField("name", file).
			Error("Unable to remove dashboard:", err)
		return err
	}
	return nil
}

// Add creates a new dashboard within the directory
func (d *Dashboards) Add(ctx context.Context, dashboard cloudhub.Dashboard) (cloudhub.Dashboard, error) {
	return cloudhub.Dashboard{}, errors.New("adding a dashboard to a filestore is not supported")
}
