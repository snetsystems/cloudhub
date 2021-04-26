package server

import (
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/canned"
	"github.com/snetsystems/cloudhub/backend/filestore"
	"github.com/snetsystems/cloudhub/backend/memdb"
	"github.com/snetsystems/cloudhub/backend/multistore"
	"github.com/snetsystems/cloudhub/backend/protoboards"
)

// LayoutBuilder is responsible for building Layouts
type LayoutBuilder interface {
	Build() (*multistore.Layouts, error)
}

// MultiLayoutBuilder implements LayoutBuilder and will return a Layouts
type MultiLayoutBuilder struct {
	Logger     cloudhub.Logger
	UUID       cloudhub.ID
	CannedPath string
}

// Build will construct a Layouts of canned personalized layouts.
func (builder *MultiLayoutBuilder) Build() (*multistore.Layouts, error) {
	// These apps are those handled from a directory
	apps := filestore.NewApps(builder.CannedPath, builder.UUID, builder.Logger)
	// These apps are statically compiled into cloudhub
	binApps := &canned.BinLayoutsStore{
		Logger: builder.Logger,
	}
	// Acts as a front-end to both the bolt layouts, filesystem layouts and binary statically compiled layouts.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem over binary data.
	layouts := &multistore.Layouts{
		Stores: []cloudhub.LayoutsStore{
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
	Logger          cloudhub.Logger
	UUID            cloudhub.ID
	ProtoboardsPath string
}

// Build will construct a Layouts of canned and db-backed personalized
// layouts
func (builder *MultiProtoboardsBuilder) Build() (*multistore.Protoboards, error) {
	// These apps are those handled from a directory
	filesystemPBs := filestore.NewProtoboards(builder.ProtoboardsPath, builder.UUID, builder.Logger)
	// These apps are statically compiled into cloudhub
	binPBs := &protoboards.BinProtoboardsStore{
		Logger: builder.Logger,
	}
	// Acts as a front-end to both the bolt layouts, filesystem layouts and binary statically compiled layouts.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem over binary data.
	protoboards := &multistore.Protoboards{
		Stores: []cloudhub.ProtoboardsStore{
			filesystemPBs,
			binPBs,
		},
	}

	return protoboards, nil
}

// DashboardBuilder is responsible for building dashboards
type DashboardBuilder interface {
	Build(cloudhub.DashboardsStore) (*multistore.DashboardsStore, error)
}

// MultiDashboardBuilder builds a DashboardsStore backed by bolt and the filesystem
type MultiDashboardBuilder struct {
	Logger cloudhub.Logger
	ID     cloudhub.ID
	Path   string
}

// Build will construct a Dashboard store of filesystem and db-backed dashboards
func (builder *MultiDashboardBuilder) Build(db cloudhub.DashboardsStore) (*multistore.DashboardsStore, error) {
	// These dashboards are those handled from a directory
	files := filestore.NewDashboards(builder.Path, builder.Logger)
	// Acts as a front-end to both the bolt dashboard and filesystem dashboards.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem
	dashboards := &multistore.DashboardsStore{
		Stores: []cloudhub.DashboardsStore{
			db,
			files,
		},
	}

	return dashboards, nil
}

// SourcesBuilder builds a MultiSourceStore
type SourcesBuilder interface {
	Build(cloudhub.SourcesStore) (*multistore.SourcesStore, error)
}

// MultiSourceBuilder implements SourcesBuilder
type MultiSourceBuilder struct {
	InfluxDBURL      string
	InfluxDBUsername string
	InfluxDBPassword string

	Logger cloudhub.Logger
	ID     cloudhub.ID
	Path   string
}

// Build will return a MultiSourceStore
func (fs *MultiSourceBuilder) Build(db cloudhub.SourcesStore) (*multistore.SourcesStore, error) {
	// These dashboards are those handled from a directory
	files := filestore.NewSources(fs.Path, fs.ID, fs.Logger)

	stores := []cloudhub.SourcesStore{db, files}

	if fs.InfluxDBURL != "" {
		influxStore := &memdb.SourcesStore{
			Source: &cloudhub.Source{
				ID:       0,
				Name:     fs.InfluxDBURL,
				Type:     cloudhub.InfluxDB,
				Username: fs.InfluxDBUsername,
				Password: fs.InfluxDBPassword,
				URL:      fs.InfluxDBURL,
				Default:  true,
				Version:  "unknown", // a real version is re-fetched at runtime; use "unknown" version as a fallback, empty version would imply OSS 2.x
			}}
		stores = append([]cloudhub.SourcesStore{influxStore}, stores...)
	}
	sources := &multistore.SourcesStore{
		Stores: stores,
	}

	return sources, nil
}

// KapacitorBuilder builds a KapacitorStore
type KapacitorBuilder interface {
	Build(cloudhub.ServersStore) (*multistore.KapacitorStore, error)
}

// MultiKapacitorBuilder implements KapacitorBuilder
type MultiKapacitorBuilder struct {
	KapacitorURL      string
	KapacitorUsername string
	KapacitorPassword string

	Logger cloudhub.Logger
	ID     cloudhub.ID
	Path   string
}

// Build will return a multistore facade KapacitorStore over memdb and bolt
func (builder *MultiKapacitorBuilder) Build(db cloudhub.ServersStore) (*multistore.KapacitorStore, error) {
	// These dashboards are those handled from a directory
	files := filestore.NewKapacitors(builder.Path, builder.ID, builder.Logger)

	stores := []cloudhub.ServersStore{db, files}

	if builder.KapacitorURL != "" {
		memStore := &memdb.KapacitorStore{
			Kapacitor: &cloudhub.Server{
				ID:       0,
				SrcID:    0,
				Name:     builder.KapacitorURL,
				URL:      builder.KapacitorURL,
				Username: builder.KapacitorUsername,
				Password: builder.KapacitorPassword,
			},
		}
		stores = append([]cloudhub.ServersStore{memStore}, stores...)
	}
	kapacitors := &multistore.KapacitorStore{
		Stores: stores,
	}
	return kapacitors, nil
}

// OrganizationBuilder is responsible for building dashboards
type OrganizationBuilder interface {
	Build(cloudhub.OrganizationsStore) (*multistore.OrganizationsStore, error)
}

// MultiOrganizationBuilder builds a OrganizationsStore backed by bolt and the filesystem
type MultiOrganizationBuilder struct {
	Logger cloudhub.Logger
	Path   string
}

// Build will construct a Organization store of filesystem and db-backed dashboards
func (builder *MultiOrganizationBuilder) Build(db cloudhub.OrganizationsStore) (*multistore.OrganizationsStore, error) {
	// These organization are those handled from a directory
	files := filestore.NewOrganizations(builder.Path, builder.Logger)
	// Acts as a front-end to both the bolt org and filesystem orgs.
	// The idea here is that these stores form a hierarchy in which each is tried sequentially until
	// the operation has success.  So, the database is preferred over filesystem
	orgs := &multistore.OrganizationsStore{
		Stores: []cloudhub.OrganizationsStore{
			db,
			files,
		},
	}

	return orgs, nil
}
