package server

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/noop"
	"github.com/snetsystems/cloudhub/backend/organizations"
	"github.com/snetsystems/cloudhub/backend/roles"
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
// the UserContextKey and that the value stored there is cloudhub.User
func hasUserContext(ctx context.Context) (*cloudhub.User, bool) {
	// prevents panic in case of nil context
	if ctx == nil {
		return nil, false
	}
	u, ok := ctx.Value(UserContextKey).(*cloudhub.User)
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
	Sources(ctx context.Context) cloudhub.SourcesStore
	Servers(ctx context.Context) cloudhub.ServersStore
	Layouts(ctx context.Context) cloudhub.LayoutsStore
	Protoboards(ctx context.Context) cloudhub.ProtoboardsStore
	Users(ctx context.Context) cloudhub.UsersStore
	Organizations(ctx context.Context) cloudhub.OrganizationsStore
	Mappings(ctx context.Context) cloudhub.MappingsStore
	Dashboards(ctx context.Context) cloudhub.DashboardsStore
	Config(ctx context.Context) cloudhub.ConfigStore
	OrganizationConfig(ctx context.Context) cloudhub.OrganizationConfigStore
	Vspheres(ctx context.Context) cloudhub.VspheresStore
	Topologies(ctx context.Context) cloudhub.TopologysStore
}

// ensure that Store implements a DataStore
var _ DataStore = &Store{}

// Store implements the DataStore interface
type Store struct {
	SourcesStore            cloudhub.SourcesStore
	ServersStore            cloudhub.ServersStore
	LayoutsStore            cloudhub.LayoutsStore
	ProtoboardsStore        cloudhub.ProtoboardsStore
	UsersStore              cloudhub.UsersStore
	DashboardsStore         cloudhub.DashboardsStore
	MappingsStore           cloudhub.MappingsStore
	OrganizationsStore      cloudhub.OrganizationsStore
	ConfigStore             cloudhub.ConfigStore
	OrganizationConfigStore cloudhub.OrganizationConfigStore
	VspheresStore           cloudhub.VspheresStore
	TopologysStore          cloudhub.TopologysStore
}

// Sources returns a noop.SourcesStore if the context has no organization specified
// and an organization.SourcesStore otherwise.
func (s *Store) Sources(ctx context.Context) cloudhub.SourcesStore {
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
func (s *Store) Servers(ctx context.Context) cloudhub.ServersStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.ServersStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewServersStore(s.ServersStore, org)
	}

	return &noop.ServersStore{}
}

// Layouts returns all layouts in the underlying layouts store.
func (s *Store) Layouts(ctx context.Context) cloudhub.LayoutsStore {
	return s.LayoutsStore
}

// Protoboards returns all protoboards in the underlying protoboards store.
func (s *Store) Protoboards(ctx context.Context) cloudhub.ProtoboardsStore {
	return s.ProtoboardsStore
}

// Users returns a cloudhub.UsersStore.
// If the context is a server context, then the underlying cloudhub.UsersStore
// is returned.
// If there is an organization specified on context, then an organizations.UsersStore
// is returned.
// If niether are specified, a noop.UsersStore is returned.
func (s *Store) Users(ctx context.Context) cloudhub.UsersStore {
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
func (s *Store) Dashboards(ctx context.Context) cloudhub.DashboardsStore {
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
func (s *Store) OrganizationConfig(ctx context.Context) cloudhub.OrganizationConfigStore {
	if orgID, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewOrganizationConfigStore(s.OrganizationConfigStore, orgID)
	}

	return &noop.OrganizationConfigStore{}
}

// Organizations returns the underlying OrganizationsStore.
func (s *Store) Organizations(ctx context.Context) cloudhub.OrganizationsStore {
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
func (s *Store) Config(ctx context.Context) cloudhub.ConfigStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.ConfigStore
	}
	if isSuperAdmin := hasSuperAdminContext(ctx); isSuperAdmin {
		return s.ConfigStore
	}

	return &noop.ConfigStore{}
}

// Mappings returns the underlying MappingsStore.
func (s *Store) Mappings(ctx context.Context) cloudhub.MappingsStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.MappingsStore
	}
	if isSuperAdmin := hasSuperAdminContext(ctx); isSuperAdmin {
		return s.MappingsStore
	}
	return &noop.MappingsStore{}
}

// Vspheres returns a noop.VspheresStore if the context has no organization specified
// and an organization.VspheresStore otherwise.
func (s *Store) Vspheres(ctx context.Context) cloudhub.VspheresStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.VspheresStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewVspheresStore(s.VspheresStore, org)
	}

	return &noop.VspheresStore{}
}

// Topologies returns a noop.TopologysStore if the context has no organization specified
// and an organization.TopologysStore otherwise.
func (s *Store) Topologies(ctx context.Context) cloudhub.TopologysStore {
	if isServer := hasServerContext(ctx); isServer {
		return s.TopologysStore
	}
	if org, ok := hasOrganizationContext(ctx); ok {
		return organizations.NewTopologysStore(s.TopologysStore, org)
	}

	return &noop.TopologysStore{}
}