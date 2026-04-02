package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Store is a server.DataStore
type Store struct {
	SourcesStore            cloudhub.SourcesStore
	MappingsStore           cloudhub.MappingsStore
	ServersStore            cloudhub.ServersStore
	LayoutsStore            cloudhub.LayoutsStore
	ProtoboardsStore        cloudhub.ProtoboardsStore
	UsersStore              cloudhub.UsersStore
	DashboardsStore             cloudhub.DashboardsStore
	FixedCellMapping     cloudhub.FixedCellMappingStore
	OrganizationsStore         cloudhub.OrganizationsStore
	ConfigStore             cloudhub.ConfigStore
	OrganizationConfigStore cloudhub.OrganizationConfigStore
	VspheresStore           cloudhub.VspheresStore
	TopologiesStore         cloudhub.TopologiesStore
	CSPStore                cloudhub.CSPStore
	NetworkDeviceStore      cloudhub.NetworkDeviceStore
	NetworkDeviceOrgStore   cloudhub.NetworkDeviceOrgStore
	MLNxRstStore            cloudhub.MLNxRstStore
	DLNxRstStore            cloudhub.DLNxRstStore
	DLNxRstStgStore         cloudhub.DLNxRstStgStore
	EsSourcesStore          cloudhub.EsSourcesStore
	DeviceMappingsStore     cloudhub.DeviceMappingsStore
	CellLibraryStore cloudhub.CellLibraryStore
	HostStore        cloudhub.HostStore
	URLMonitoringStore      cloudhub.URLMonitoringStore
}

// Sources ...
func (s *Store) Sources(ctx context.Context) cloudhub.SourcesStore {
	return s.SourcesStore
}

// Servers ...
func (s *Store) Servers(ctx context.Context) cloudhub.ServersStore {
	return s.ServersStore
}

// Layouts ...
func (s *Store) Layouts(ctx context.Context) cloudhub.LayoutsStore {
	return s.LayoutsStore
}

// Protoboards ...
func (s *Store) Protoboards(ctx context.Context) cloudhub.ProtoboardsStore {
	return s.ProtoboardsStore
}

// Users ...
func (s *Store) Users(ctx context.Context) cloudhub.UsersStore {
	return s.UsersStore
}

// Organizations ...
func (s *Store) Organizations(ctx context.Context) cloudhub.OrganizationsStore {
	return s.OrganizationsStore
}

// Mappings ...
func (s *Store) Mappings(ctx context.Context) cloudhub.MappingsStore {
	return s.MappingsStore
}

// Dashboards ...
func (s *Store) Dashboards(ctx context.Context) cloudhub.DashboardsStore {
	return s.DashboardsStore
}

// FixedCellMappingStore ...
func (s *Store) FixedCellMappingStore() cloudhub.FixedCellMappingStore {
	return s.FixedCellMapping
}

// Config ...
func (s *Store) Config(ctx context.Context) cloudhub.ConfigStore {
	return s.ConfigStore
}

// OrganizationConfig ...
func (s *Store) OrganizationConfig(ctx context.Context) cloudhub.OrganizationConfigStore {
	return s.OrganizationConfigStore
}

// Vspheres ...
func (s *Store) Vspheres(ctx context.Context) cloudhub.VspheresStore {
	return s.VspheresStore
}

// Topologies ...
func (s *Store) Topologies(ctx context.Context) cloudhub.TopologiesStore {
	return s.TopologiesStore
}

// CSP ...
func (s *Store) CSP(ctx context.Context) cloudhub.CSPStore {
	return s.CSPStore
}

// NetworkDevice ...
func (s *Store) NetworkDevice(ctx context.Context) cloudhub.NetworkDeviceStore {
	return s.NetworkDeviceStore
}

// NetworkDeviceOrg ...
func (s *Store) NetworkDeviceOrg(ctx context.Context) cloudhub.NetworkDeviceOrgStore {
	return s.NetworkDeviceOrgStore
}

// MLNxRst ...
func (s *Store) MLNxRst(ctx context.Context) cloudhub.MLNxRstStore {
	return s.MLNxRstStore
}

// DLNxRst ...
func (s *Store) DLNxRst(ctx context.Context) cloudhub.DLNxRstStore {
	return s.DLNxRstStore
}

// DLNxRstStg ...
func (s *Store) DLNxRstStg(ctx context.Context) cloudhub.DLNxRstStgStore {
	return s.DLNxRstStgStore
}

// EsSources ...
func (s *Store) EsSources(ctx context.Context) cloudhub.EsSourcesStore {
	return s.EsSourcesStore
}

// DeviceMappings ...
func (s *Store) DeviceMappings(ctx context.Context) cloudhub.DeviceMappingsStore {
	return s.DeviceMappingsStore
}

// CellLibrary ...
func (s *Store) CellLibrary(ctx context.Context) cloudhub.CellLibraryStore {
	return s.CellLibraryStore
}

// Hosts ...
func (s *Store) Hosts(ctx context.Context) cloudhub.HostStore {
	return s.HostStore
}

// URLMonitoring ...
func (s *Store) URLMonitoring(ctx context.Context) cloudhub.URLMonitoringStore {
	return s.URLMonitoringStore
}
