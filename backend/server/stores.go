package server

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/noop"
	"github.com/snetsystems/cmp/backend/organizations"
	"github.com/snetsystems/cmp/backend/roles"
	platform "github.com/snetsystems/cmp/backend/v2"
)

// hasOrganizationContext retrieves organization specified on context
// under the organizations.ContextKey
func hasOrganizationContext(ctx context.Context) (string, bool) {
	// prevents panic in case of nil context
	if ctx == nil {
		return "", false
	}
	orgID, ok := ctx.Value(organizations.ContextKey).(string)
	// should never happen
	if !ok {
		return "", false
	}
	if orgID == "" {
		return "", false
	}
	return orgID, true
}

// hasRoleContext retrieves organization specified on context
// under the organizations.ContextKey
func hasRoleContext(ctx context.Context) (string, bool) {
	// prevents panic in case of nil context
	if ctx == nil {
		return "", false
	}
	role, ok := ctx.Value(roles.ContextKey).(string)
	// should never happen
	if !ok {
		return "", false
	}
	switch role {
	case roles.MemberRoleName, roles.ViewerRoleName, roles.EditorRoleName, roles.AdminRoleName:
		return role, true
	default:
		return "", false
	}
}

type userContextKey string

// UserContextKey is the context key for retrieving the user off of context
const UserContextKey = userContextKey("user")

// hasUserContext speficies if the context contains
// the UserContextKey and that the value stored there is cmp.User
func hasUserContext(ctx context.Context) (*cmp.User, bool) {
	// prevents panic in case of nil context
	if ctx == nil {
		return nil, false
	}
	u, ok := ctx.Value(UserContextKey).(*cmp.User)
	// should never happen
	if !ok {
		return nil, false
	}
	if u == nil {
		return nil, false
	}
	return u, true
}

// hasSuperAdminContext speficies if the context contains
// the UserContextKey user is a super admin
func hasSuperAdminContext(ctx context.Context) bool {
	u, ok := hasUserContext(ctx)
	if !ok {
		return false
	}
	return u.SuperAdmin
}

// DataStore is collection of resources that are used by the Service
// Abstracting this into an interface was useful for isolated testing
type DataStore interface {
	Sources(ctx context.Context) cmp.SourcesStore
	Servers(ctx context.Context) cmp.ServersStore
	Layouts(ctx context.Context) cmp.LayoutsStore
	Protoboards(ctx context.Context) cmp.ProtoboardsStore
	Users(ctx context.Context) cmp.UsersStore
	Organizations(ctx context.Context) cmp.OrganizationsStore
	Mappings(ctx context.Context) cmp.MappingsStore
	Dashboards(ctx context.Context) cmp.DashboardsStore
	Config(ctx context.Context) cmp.ConfigStore
	OrganizationConfig(ctx context.Context) cmp.OrganizationConfigStore
	Cells(ctx context.Context) platform.CellService
	DashboardsV2(ctx context.Context) platform.DashboardService
}

// ensure that Store implements a DataStore
var _ DataStore = &Store{}

// Store implements the DataStore interface
type Store struct {
	SourcesStore            cmp.SourcesStore
	ServersStore            cmp.ServersStore
	LayoutsStore            cmp.LayoutsStore
	ProtoboardsStore        cmp.ProtoboardsStore
	UsersStore              cmp.UsersStore
	DashboardsStore         cmp.DashboardsStore
	MappingsStore           cmp.MappingsStore
	OrganizationsStore      cmp.OrganizationsStore
	ConfigStore             cmp.ConfigStore
	OrganizationConfigStore cmp.OrganizationConfigStore
	CellService             platform.CellService
	DashboardService        platform.DashboardService
}

// Sources returns a noop.SourcesStore if the context has no organization specified
// and an organization.SourcesStore otherwise.
func (s *Store) Sources(ctx context.Context) cmp.SourcesStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.SourcesStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewSourcesStore(s.SourcesStore, org)
	}

	return &noop.SourcesStore{}
}

// Servers returns a noop.ServersStore if the context has no organization specified
// and an organization.ServersStore otherwise.
func (s *Store) Servers(ctx context.Context) cmp.ServersStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.ServersStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewServersStore(s.ServersStore, org)
	}

	return &noop.ServersStore{}
}

// Layouts returns all layouts in the underlying layouts store.
func (s *Store) Layouts(ctx context.Context) cmp.LayoutsStore {
	return s.LayoutsStore
}

// Protoboards returns all protoboards in the underlying protoboards store.
func (s *Store) Protoboards(ctx context.Context) cmp.ProtoboardsStore {
	return s.ProtoboardsStore
}

// Users returns a cmp.UsersStore.
// If the context is a server context, then the underlying cmp.UsersStore
// is returned.
// If there is an organization specified on context, then an organizations.UsersStore
// is returned.
// If niether are specified, a noop.UsersStore is returned.
func (s *Store) Users(ctx context.Context) cmp.UsersStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.UsersStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewUsersStore(s.UsersStore, org)
	}

	return &noop.UsersStore{}
}

// Dashboards returns a noop.DashboardsStore if the context has no organization specified
// and an organization.DashboardsStore otherwise.
func (s *Store) Dashboards(ctx context.Context) cmp.DashboardsStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.DashboardsStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewDashboardsStore(s.DashboardsStore, org)
	}

	return &noop.DashboardsStore{}
}

// OrganizationConfig returns a noop.OrganizationConfigStore if the context has no organization specified
// and an organization.OrganizationConfigStore otherwise.
func (s *Store) OrganizationConfig(ctx context.Context) cmp.OrganizationConfigStore {
	if orgID, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewOrganizationConfigStore(s.OrganizationConfigStore, orgID)
	}

	return &noop.OrganizationConfigStore{}
}

// Organizations returns the underlying OrganizationsStore.
func (s *Store) Organizations(ctx context.Context) cmp.OrganizationsStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.OrganizationsStore
	}
	if isSuperAdmin := hasSuperAdminContext(ctx); isSuperAdmin {
		return s.OrganizationsStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewOrganizationsStore(s.OrganizationsStore, org)
	}
	return &noop.OrganizationsStore{}
}

// Config returns the underlying ConfigStore.
func (s *Store) Config(ctx context.Context) cmp.ConfigStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.ConfigStore
	}
	if isSuperAdmin := hasSuperAdminContext(ctx); isSuperAdmin {
		return s.ConfigStore
	}

	return &noop.ConfigStore{}
}

// Mappings returns the underlying MappingsStore.
func (s *Store) Mappings(ctx context.Context) cmp.MappingsStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.MappingsStore
	}
	if isSuperAdmin := hasSuperAdminContext(ctx); isSuperAdmin {
		return s.MappingsStore
	}
	return &noop.MappingsStore{}
}

// Cells returns the underlying CellService.
func (s *Store) Cells(ctx context.Context) platform.CellService {
	return s.CellService
}

// DashboardsV2 returns the underlying DashboardsService.
func (s *Store) DashboardsV2(ctx context.Context) platform.DashboardService {
	return s.DashboardService
}
