package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
	platform "github.com/snetsystems/cmp/backend/v2"
)

// Store is a server.DataStore
type Store struct {
	SourcesStore            cmp.SourcesStore
	MappingsStore           cmp.MappingsStore
	ServersStore            cmp.ServersStore
	LayoutsStore            cmp.LayoutsStore
	ProtoboardsStore        cmp.ProtoboardsStore
	UsersStore              cmp.UsersStore
	DashboardsStore         cmp.DashboardsStore
	OrganizationsStore      cmp.OrganizationsStore
	ConfigStore             cmp.ConfigStore
	OrganizationConfigStore cmp.OrganizationConfigStore
	CellService             platform.CellService
	DashboardService        platform.DashboardService
}

func (s *Store) Sources(ctx context.Context) cmp.SourcesStore {
	return s.SourcesStore
}

func (s *Store) Servers(ctx context.Context) cmp.ServersStore {
	return s.ServersStore
}

func (s *Store) Layouts(ctx context.Context) cmp.LayoutsStore {
	return s.LayoutsStore
}

func (s *Store) Protoboards(ctx context.Context) cmp.ProtoboardsStore {
	return s.ProtoboardsStore
}

func (s *Store) Users(ctx context.Context) cmp.UsersStore {
	return s.UsersStore
}

func (s *Store) Organizations(ctx context.Context) cmp.OrganizationsStore {
	return s.OrganizationsStore
}

func (s *Store) Mappings(ctx context.Context) cmp.MappingsStore {
	return s.MappingsStore
}

func (s *Store) Dashboards(ctx context.Context) cmp.DashboardsStore {
	return s.DashboardsStore
}

func (s *Store) Config(ctx context.Context) cmp.ConfigStore {
	return s.ConfigStore
}

func (s *Store) OrganizationConfig(ctx context.Context) cmp.OrganizationConfigStore {
	return s.OrganizationConfigStore
}

func (s *Store) Cells(ctx context.Context) platform.CellService {
	return s.CellService
}

func (s *Store) DashboardsV2(ctx context.Context) platform.DashboardService {
	return s.DashboardService
}
