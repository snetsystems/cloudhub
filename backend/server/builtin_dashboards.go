package server

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// InitializeBuiltinDashboards initializes builtin dashboards for an organization.
// It loads all builtin dashboards from the builtin store, sets the organization ID,
// ensures the type is "builtin", and adds them to the dashboards store.
// It skips dashboards that already exist (based on name and organization).
func InitializeBuiltinDashboards(
	ctx context.Context,
	orgID string,
	dashboardsStore cloudhub.DashboardsStore,
	builtinStore *builtin.BinDashboardsStore,
	logger cloudhub.Logger,
) error {
	// Get all builtin dashboards from the builtin store
	builtinDashboards, err := builtinStore.All(ctx)
	if err != nil {
		logger.
			WithField("component", "builtin").
			WithField("organization", orgID).
			Error("Failed to load builtin dashboards:", err)
		return err
	}

	// Get existing dashboards for this organization to check for duplicates
	orgCtx := context.WithValue(ctx, organizations.ContextKey, orgID)
	existingDashboards, err := dashboardsStore.All(orgCtx)
	if err != nil {
		logger.
			WithField("component", "builtin").
			WithField("organization", orgID).
			Error("Failed to load existing dashboards:", err)
		return err
	}

	// Create a map of existing builtin dashboards by name for quick lookup
	existingBuiltinMap := make(map[string]bool)
	for _, d := range existingDashboards {
		if d.Type == "builtin" && d.Organization == orgID {
			existingBuiltinMap[d.Name] = true
		}
	}

	// Initialize each builtin dashboard
	for _, dashboard := range builtinDashboards {
		// Skip if this builtin dashboard already exists for this organization
		if existingBuiltinMap[dashboard.Name] {
			logger.
				WithField("component", "builtin").
				WithField("organization", orgID).
				WithField("dashboard", dashboard.Name).
				Debug("Builtin dashboard already exists, skipping")
			continue
		}

		// Set organization and ensure type is "builtin"
		dashboard.Organization = orgID
		dashboard.Type = "builtin"
		// ID will be set by the store's Add method

		// Add the dashboard to the store
		_, err := dashboardsStore.Add(orgCtx, dashboard)
		if err != nil {
			logger.
				WithField("component", "builtin").
				WithField("organization", orgID).
				WithField("dashboard", dashboard.Name).
				Error("Failed to add builtin dashboard:", err)
			// Continue with other dashboards even if one fails
			continue
		}

		logger.
			WithField("component", "builtin").
			WithField("organization", orgID).
			WithField("dashboard", dashboard.Name).
			Info("Initialized builtin dashboard")
	}

	return nil
}
