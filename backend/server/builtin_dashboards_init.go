package server

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
)

// initializeDefaultOrgBuiltinDashboards initializes builtin dashboards for the default organization
// if it doesn't already have them. This is called during server startup.
func initializeDefaultOrgBuiltinDashboards(ctx context.Context, service *Service, logger cloudhub.Logger) error {
	// Use server context to access stores directly
	serverCtx := serverContext(ctx)

	// Get default organization
	defaultOrg, err := service.Store.Organizations(serverCtx).DefaultOrganization(serverCtx)
	if err != nil {
		logger.
			WithField("component", "builtin").
			Error("Failed to get default organization:", err)
		return err
	}

	// Create builtin dashboard store
	builtinStore := &builtin.BinDashboardsStore{
		Logger: logger,
	}

	// Get dashboards store with server context (direct access, no org filtering)
	dashboardsStore := service.Store.Dashboards(serverCtx)
	mappingStore := service.Store.BuiltinDashboardMappingStore()

	// Initialize builtin dashboards for default organization
	return InitializeBuiltinDashboards(
		serverCtx,
		defaultOrg.ID,
		dashboardsStore,
		builtinStore,
		mappingStore,
		logger,
	)
}
