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

// ApplyBuiltinDashboardToOrg updates the given org's builtin dashboard from the latest template:
// - Templates, Version, UpdatedAt: replaced from template.
// - Cells: only cells with Type "fixed" are updated, and only their Queries field is replaced from the template (matched by cell ID, json "i"). All other cells and all other cell fields are left unchanged.
func ApplyBuiltinDashboardToOrg(
	ctx context.Context,
	orgID string,
	builtinName string,
	dashboardsStore cloudhub.DashboardsStore,
	builtinStore *builtin.BinDashboardsStore,
	mappingStore cloudhub.BuiltinDashboardMappingStore,
	logger cloudhub.Logger,
) error {
	dashboardID, err := mappingStore.GetDashboardID(ctx, orgID, builtinName)
	if err != nil {
		return err
	}

	dash, err := dashboardsStore.Get(ctx, dashboardID)
	if err != nil {
		logger.
			WithField("component", "builtin").
			WithField("builtinName", builtinName).
			WithField("orgID", orgID).
			Error("Failed to get dashboard for apply:", err)
		return err
	}
	if dash.Organization != orgID {
		return cloudhub.ErrDashboardNotFound
	}

	template, err := builtinStore.Get(ctx, builtinName)
	if err != nil {
		logger.
			WithField("component", "builtin").
			WithField("builtinName", builtinName).
			Error("Failed to load builtin template:", err)
		return err
	}

	// Build map: template cell ID (i) -> queries (only for component type)
	templateQueriesByID := make(map[string][]cloudhub.DashboardQuery)
	for i := range template.Cells {
		c := &template.Cells[i]
		if c.Type == "component" && c.ID != "" {
			templateQueriesByID[c.ID] = cloneDashboardQueries(c.Queries)
		}
	}

	// For org dashboard: only update Queries on cells with type "component", from template by cell ID (i)
	for i := range dash.Cells {
		c := &dash.Cells[i]
		if c.Type != "component" {
			continue
		}
		if queries, ok := templateQueriesByID[c.ID]; ok {
			dash.Cells[i].Queries = queries
		}
	}

	dash.Templates = template.Templates
	dash.Version = template.Version
	dash.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := dashboardsStore.Update(ctx, dash); err != nil {
		logger.
			WithField("component", "builtin").
			WithField("builtinName", builtinName).
			WithField("orgID", orgID).
			Error("Failed to update dashboard on apply:", err)
		return err
	}

	logger.
		WithField("component", "builtin").
		WithField("builtinName", builtinName).
		WithField("orgID", orgID).
		Info("Applied builtin template (component cells: queries only) to org dashboard")
	return nil
}

func cloneDashboardQueries(q []cloudhub.DashboardQuery) []cloudhub.DashboardQuery {
	if q == nil {
		return nil
	}
	out := make([]cloudhub.DashboardQuery, len(q))
	copy(out, q)
	return out
}
