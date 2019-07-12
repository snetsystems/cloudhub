package server

import (
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/canned"
	"github.com/snetsystems/cmp/backend/filestore"
	"github.com/snetsystems/cmp/backend/memdb"
	"github.com/snetsystems/cmp/backend/multistore"
	"github.com/snetsystems/cmp/backend/protoboards"
)

// LayoutBuilder is responsible for building Layouts
type LayoutBuilder interface {
	Build(cmp.LayoutsStore) (*multistore.Layouts, error)
}

// MultiLayoutBuilder implements LayoutBuilder and will return a Layouts
type MultiLayoutBuilder struct {
	Logger     cmp.Logger
	UUID       cmp.ID
	CannedPath string
}

// Build will construct a Layouts of canned and db-backed personalized
// layouts
func (builder *MultiLayoutBuilder) Build(db cmp.LayoutsStore) (*multistore.Layouts, error) {
	// These apps are those handled from a directory
	apps := filestore.NewApps(builder.CannedPath, builder.UUID, builder.Logger)
	// These apps are statically compiled into cmp
	binApps := &canned.BinLayoutsStore{
		Logger: builder.Logger,
	}
	// Acts as a front-end to both the bolt layouts, filesystem layouts and binary statically compiled layouts.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem over binary data.
	layouts := &multistore.Layouts{
		Stores: []cmp.LayoutsStore{
			db,
			apps,
			binApps,
		},
	}

	return layouts, nil
}

// ProtoboardsBuilder is responsible for building Protoboards
type ProtoboardsBuilder interface {
	Build() (*multistore.Protoboards, error)
}

// MultiProtoboardsBuilder implements LayoutBuilder and will return a Layouts
type MultiProtoboardsBuilder struct {
	Logger          cmp.Logger
	UUID            cmp.ID
	ProtoboardsPath string
}

// Build will construct a Layouts of canned and db-backed personalized
// layouts
func (builder *MultiProtoboardsBuilder) Build() (*multistore.Protoboards, error) {
	// These apps are those handled from a directory
	filesystemPBs := filestore.NewProtoboards(builder.ProtoboardsPath, builder.UUID, builder.Logger)
	// These apps are statically compiled into cmp
	binPBs := &protoboards.BinProtoboardsStore{
		Logger: builder.Logger,
	}
	// Acts as a front-end to both the bolt layouts, filesystem layouts and binary statically compiled layouts.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem over binary data.
	protoboards := &multistore.Protoboards{
		Stores: []cmp.ProtoboardsStore{
			filesystemPBs,
			binPBs,
		},
	}

	return protoboards, nil
}

// DashboardBuilder is responsible for building dashboards
type DashboardBuilder interface {
	Build(cmp.DashboardsStore) (*multistore.DashboardsStore, error)
}

// MultiDashboardBuilder builds a DashboardsStore backed by bolt and the filesystem
type MultiDashboardBuilder struct {
	Logger cmp.Logger
	ID     cmp.ID
	Path   string
}

// Build will construct a Dashboard store of filesystem and db-backed dashboards
func (builder *MultiDashboardBuilder) Build(db cmp.DashboardsStore) (*multistore.DashboardsStore, error) {
	// These dashboards are those handled from a directory
	files := filestore.NewDashboards(builder.Path, builder.ID, builder.Logger)
	// Acts as a front-end to both the bolt dashboard and filesystem dashboards.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem
	dashboards := &multistore.DashboardsStore{
		Stores: []cmp.DashboardsStore{
			db,
			files,
		},
	}

	return dashboards, nil
}

// SourcesBuilder builds a MultiSourceStore
type SourcesBuilder interface {
	Build(cmp.SourcesStore) (*multistore.SourcesStore, error)
}

// MultiSourceBuilder implements SourcesBuilder
type MultiSourceBuilder struct {
	InfluxDBURL      string
	InfluxDBUsername string
	InfluxDBPassword string

	Logger cmp.Logger
	ID     cmp.ID
	Path   string
}

// Build will return a MultiSourceStore
func (fs *MultiSourceBuilder) Build(db cmp.SourcesStore) (*multistore.SourcesStore, error) {
	// These dashboards are those handled from a directory
	files := filestore.NewSources(fs.Path, fs.ID, fs.Logger)

	stores := []cmp.SourcesStore{db, files}

	if fs.InfluxDBURL != "" {
		influxStore := &memdb.SourcesStore{
			Source: &cmp.Source{
				ID:       0,
				Name:     fs.InfluxDBURL,
				Type:     cmp.InfluxDB,
				Username: fs.InfluxDBUsername,
				Password: fs.InfluxDBPassword,
				URL:      fs.InfluxDBURL,
				Default:  true,
			}}
		stores = append([]cmp.SourcesStore{influxStore}, stores...)
	}
	sources := &multistore.SourcesStore{
		Stores: stores,
	}

	return sources, nil
}

// KapacitorBuilder builds a KapacitorStore
type KapacitorBuilder interface {
	Build(cmp.ServersStore) (*multistore.KapacitorStore, error)
}

// MultiKapacitorBuilder implements KapacitorBuilder
type MultiKapacitorBuilder struct {
	KapacitorURL      string
	KapacitorUsername string
	KapacitorPassword string

	Logger cmp.Logger
	ID     cmp.ID
	Path   string
}

// Build will return a multistore facade KapacitorStore over memdb and bolt
func (builder *MultiKapacitorBuilder) Build(db cmp.ServersStore) (*multistore.KapacitorStore, error) {
	// These dashboards are those handled from a directory
	files := filestore.NewKapacitors(builder.Path, builder.ID, builder.Logger)

	stores := []cmp.ServersStore{db, files}

	if builder.KapacitorURL != "" {
		memStore := &memdb.KapacitorStore{
			Kapacitor: &cmp.Server{
				ID:       0,
				SrcID:    0,
				Name:     builder.KapacitorURL,
				URL:      builder.KapacitorURL,
				Username: builder.KapacitorUsername,
				Password: builder.KapacitorPassword,
			},
		}
		stores = append([]cmp.ServersStore{memStore}, stores...)
	}
	kapacitors := &multistore.KapacitorStore{
		Stores: stores,
	}
	return kapacitors, nil
}

// OrganizationBuilder is responsible for building dashboards
type OrganizationBuilder interface {
	Build(cmp.OrganizationsStore) (*multistore.OrganizationsStore, error)
}

// MultiOrganizationBuilder builds a OrganizationsStore backed by bolt and the filesystem
type MultiOrganizationBuilder struct {
	Logger cmp.Logger
	Path   string
}

// Build will construct a Organization store of filesystem and db-backed dashboards
func (builder *MultiOrganizationBuilder) Build(db cmp.OrganizationsStore) (*multistore.OrganizationsStore, error) {
	// These organization are those handled from a directory
	files := filestore.NewOrganizations(builder.Path, builder.Logger)
	// Acts as a front-end to both the bolt org and filesystem orgs.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem
	orgs := &multistore.OrganizationsStore{
		Stores: []cmp.OrganizationsStore{
			db,
			files,
		},
	}

	return orgs, nil
}
