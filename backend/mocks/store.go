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
	DashboardsStore         cloudhub.DashboardsStore
	OrganizationsStore      cloudhub.OrganizationsStore
	ConfigStore             cloudhub.ConfigStore
	OrganizationConfigStore cloudhub.OrganizationConfigStore
	VspheresStore           cloudhub.VspheresStore
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