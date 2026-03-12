package server

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
)

// initializeAllOrgsFixedCells initializes fixed-cell dashboards for all organizations
// so that every org has every builtin template (e.g. server_overview, host_page).
// Existing dashboards are skipped by InitializeFixedCells; only missing ones are added.
// This is called during server startup so that existing orgs get new templates (e.g. server_overview)
// without requiring manual apply.
func initializeAllOrgsFixedCells(ctx context.Context, service *Service, logger cloudhub.Logger) error {
	serverCtx := serverContext(ctx)

	orgs, err := service.Store.Organizations(serverCtx).All(serverCtx)
	if err != nil {
		logger.
			WithField("component", "fixed-cell").
			Error("Failed to list organizations:", err)
		return err
	}

	builtinStore := &builtin.BinDashboardsStore{
		Logger: logger,
	}
	dashboardsStore := service.Store.Dashboards(serverCtx)
	mappingStore := service.Store.FixedCellMappingStore()

	for _, org := range orgs {
		if err := InitializeFixedCells(
			serverCtx,
			org.ID,
			dashboardsStore,
			builtinStore,
			mappingStore,
			logger,
		); err != nil {
			logger.
				WithField("component", "fixed-cell").
				WithField("organization", org.ID).
				Error("Failed to initialize fixed-cell dashboards for organization:", err)
			// Continue with other orgs
			continue
		}
	}

	return nil
}
