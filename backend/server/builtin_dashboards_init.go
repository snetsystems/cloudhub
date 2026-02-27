package server

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
)

// initializeDefaultOrgFixedCells initializes fixed-cell dashboards for the default organization
// if it doesn't already have them. This is called during server startup.
func initializeDefaultOrgFixedCells(ctx context.Context, service *Service, logger cloudhub.Logger) error {
	// Use server context to access stores directly
	serverCtx := serverContext(ctx)

	// Get default organization
	defaultOrg, err := service.Store.Organizations(serverCtx).DefaultOrganization(serverCtx)
	if err != nil {
		logger.
			WithField("component", "fixed-cell").
			Error("Failed to get default organization:", err)
		return err
	}

	// Create fixed-cell template store (builtin package embeds JSON templates)
	builtinStore := &builtin.BinDashboardsStore{
		Logger: logger,
	}

	// Get dashboards store with server context (direct access, no org filtering)
	dashboardsStore := service.Store.Dashboards(serverCtx)
	mappingStore := service.Store.FixedCellMappingStore()

	// Initialize fixed-cell dashboards for default organization
	if err := InitializeFixedCells(
		serverCtx,
		defaultOrg.ID,
		dashboardsStore,
		builtinStore,
		mappingStore,
		logger,
	); err != nil {
		return err
	}

	// No auto-apply on GET /fixed-cells/:name; user applies via Update button (POST /fixed-cells/:name/apply)
	// per template name to avoid startup load.
	return nil
}
