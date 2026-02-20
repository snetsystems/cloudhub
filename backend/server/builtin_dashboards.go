package server

import (
	"context"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// InitializeBuiltinDashboards initializes builtin dashboards for an organization.
// It loads all builtin dashboards from the builtin store, sets the organization ID,
// ensures the type is "builtin", and adds them to the dashboards store.
// It also registers (orgID, name) -> dashboard ID in the mapping store for name-based lookup.
// It skips dashboards that already exist (based on name and organization).
func InitializeBuiltinDashboards(
	ctx context.Context,
	orgID string,
	dashboardsStore cloudhub.DashboardsStore,
	builtinStore *builtin.BinDashboardsStore,
	mappingStore cloudhub.BuiltinDashboardMappingStore,
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

	// Map existing builtin dashboard name -> ID (for skip and for mapping backfill)
	existingBuiltinByName := make(map[string]cloudhub.DashboardID)
	for _, d := range existingDashboards {
		if d.Type == cloudhub.DashboardTypeBuiltin && d.Organization == orgID && d.Name != "" {
			existingBuiltinByName[d.Name] = d.ID
		}
	}

	// Initialize each builtin dashboard
	for _, dashboard := range builtinDashboards {
		// If already exists: ensure mapping is registered (backfill for orgs created before mapping feature)
		if existingID, exists := existingBuiltinByName[dashboard.Name]; exists {
			if err := mappingStore.Register(ctx, orgID, dashboard.Name, existingID); err != nil {
				logger.
					WithField("component", "builtin").
					WithField("organization", orgID).
					WithField("dashboard", dashboard.Name).
					Error("Failed to register builtin dashboard mapping (existing):", err)
			}
			logger.
				WithField("component", "builtin").
				WithField("organization", orgID).
				WithField("dashboard", dashboard.Name).
				Debug("Builtin dashboard already exists, ensured mapping")
			continue
		}

		// Set organization and ensure type is builtin
		dashboard.Organization = orgID
		dashboard.Type = cloudhub.DashboardTypeBuiltin
		for j := range dashboard.Cells {
			dashboard.Cells[j].CellOrigin = cloudhub.CellOriginBuiltin
		}
		// ID will be set by the store's Add method

		// Add the dashboard to the store
		added, err := dashboardsStore.Add(orgCtx, dashboard)
		if err != nil {
			logger.
				WithField("component", "builtin").
				WithField("organization", orgID).
				WithField("dashboard", dashboard.Name).
				Error("Failed to add builtin dashboard:", err)
			// Continue with other dashboards even if one fails
			continue
		}

		if err := mappingStore.Register(ctx, orgID, added.Name, added.ID); err != nil {
			logger.
				WithField("component", "builtin").
				WithField("organization", orgID).
				WithField("dashboard", added.Name).
				Error("Failed to register builtin dashboard mapping:", err)
		}

		logger.
			WithField("component", "builtin").
			WithField("organization", orgID).
			WithField("dashboard", dashboard.Name).
			Info("Initialized builtin dashboard")
	}

	return nil
}

// SyncBuiltinTemplatesToAllOrgs updates only the Templates field of every org's dashboard
// that was created from the builtin named builtinName. Cells and other fields are left unchanged.
// dashboardsStore must be the store from server context (not org-scoped) so all dashboards can be read/updated.
func SyncBuiltinTemplatesToAllOrgs(
	ctx context.Context,
	builtinName string,
	dashboardsStore cloudhub.DashboardsStore,
	builtinStore *builtin.BinDashboardsStore,
	mappingStore cloudhub.BuiltinDashboardMappingStore,
	logger cloudhub.Logger,
) error {
	template, err := builtinStore.Get(ctx, builtinName)
	if err != nil {
		return err
	}

	entries, err := mappingStore.ListByBuiltinName(ctx, builtinName)
	if err != nil {
		logger.
			WithField("component", "builtin").
			WithField("builtinName", builtinName).
			Error("Failed to list builtin dashboard mappings:", err)
		return err
	}

	for _, e := range entries {
		dash, err := dashboardsStore.Get(ctx, e.DashboardID)
		if err != nil {
			logger.
				WithField("component", "builtin").
				WithField("builtinName", builtinName).
				WithField("orgID", e.OrgID).
				WithField("dashboardID", e.DashboardID).
				Error("Failed to get dashboard for template sync:", err)
			continue
		}
		if dash.Organization != e.OrgID {
			continue
		}
		dash.Templates = template.Templates
		dash.Version = template.Version
		dash.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := dashboardsStore.Update(ctx, dash); err != nil {
			logger.
				WithField("component", "builtin").
				WithField("builtinName", builtinName).
				WithField("orgID", e.OrgID).
				WithField("dashboardID", e.DashboardID).
				Error("Failed to update dashboard templates:", err)
			continue
		}
		logger.
			WithField("component", "builtin").
			WithField("builtinName", builtinName).
			WithField("orgID", e.OrgID).
			Debug("Synced builtin templates to org dashboard")
	}
	return nil
}
