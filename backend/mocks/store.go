package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	platform "github.com/snetsystems/cloudhub/backend/v2"
)

// Store is a server.DataStore
type Store struct {
	SourcesStore            cloudhub.SourcesStore
	MappingsStore           cloudhub.MappingsStore
	ServersStore            cloudhub.ServersStore
	LayoutsStore            cloudhub.LayoutsStore
	ProtoboardsStore        cloudhub.ProtoboardsStore
	UsersStore              cloudhub.UsersStore
	DashboardsStore         cloudhub.DashboardsStore
	OrganizationsStore      cloudhub.OrganizationsStore
	ConfigStore             cloudhub.ConfigStore
	OrganizationConfigStore cloudhub.OrganizationConfigStore
	CellService             platform.CellService
	DashboardService        platform.DashboardService
}

func (s *Store) Sources(ctx context.Context) cloudhub.SourcesStore {
	return s.SourcesStore
}

func (s *Store) Servers(ctx context.Context) cloudhub.ServersStore {
	return s.ServersStore
}

func (s *Store) Layouts(ctx context.Context) cloudhub.LayoutsStore {
	return s.LayoutsStore
}

func (s *Store) Protoboards(ctx context.Context) cloudhub.ProtoboardsStore {
	return s.ProtoboardsStore
}

func (s *Store) Users(ctx context.Context) cloudhub.UsersStore {
	return s.UsersStore
}

func (s *Store) Organizations(ctx context.Context) cloudhub.OrganizationsStore {
	return s.OrganizationsStore
}

func (s *Store) Mappings(ctx context.Context) cloudhub.MappingsStore {
	return s.MappingsStore
}

func (s *Store) Dashboards(ctx context.Context) cloudhub.DashboardsStore {
	return s.DashboardsStore
}

func (s *Store) Config(ctx context.Context) cloudhub.ConfigStore {
	return s.ConfigStore
}

func (s *Store) OrganizationConfig(ctx context.Context) cloudhub.OrganizationConfigStore {
	return s.OrganizationConfigStore
}

func (s *Store) Cells(ctx context.Context) platform.CellService {
	return s.CellService
}

func (s *Store) DashboardsV2(ctx context.Context) platform.DashboardService {
	return s.DashboardService
}
