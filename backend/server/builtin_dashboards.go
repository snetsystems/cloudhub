package server

import (
	"context"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// InitializeFixedCells initializes fixed-cell dashboards for an organization.
// It loads all templates from the builtin store, sets the organization ID,
// ensures the type is "builtin", and adds them to the dashboards store.
// It also registers (orgID, name) -> dashboard ID in the mapping store for name-based lookup.
// It skips dashboards that already exist (based on name and organization).
func InitializeFixedCells(
	ctx context.Context,
	orgID string,
	dashboardsStore cloudhub.DashboardsStore,
	builtinStore *builtin.BinDashboardsStore,
	mappingStore cloudhub.FixedCellMappingStore,
	logger cloudhub.Logger,
) error {
	// Get all fixed-cells from the builtin store
	templates, err := builtinStore.All(ctx)
	if err != nil {
		logger.
			WithField("component", "fixed-cell").
			WithField("organization", orgID).
			Error("Failed to load fixed-cell templates:", err)
		return err
	}

	// Get existing dashboards for this organization to check for duplicates
	orgCtx := context.WithValue(ctx, organizations.ContextKey, orgID)
	existingDashboards, err := dashboardsStore.All(orgCtx)
	if err != nil {
		logger.
			WithField("component", "fixed-cell").
			WithField("organization", orgID).
			Error("Failed to load existing dashboards:", err)
		return err
	}

	// Map existing fixed-cell name -> ID (for skip and for mapping backfill)
	existingByName := make(map[string]cloudhub.DashboardID)
	for _, d := range existingDashboards {
		if d.Type == cloudhub.DashboardTypeBuiltin && d.Organization == orgID && d.Name != "" {
			existingByName[d.Name] = d.ID
		}
	}

	// Initialize each fixed-cell dashboard
	for _, dashboard := range templates {
		// If already exists: ensure mapping is registered (backfill for orgs created before mapping feature)
		if existingID, exists := existingByName[dashboard.Name]; exists {
			if err := mappingStore.Register(ctx, orgID, dashboard.Name, existingID); err != nil {
				logger.
					WithField("component", "fixed-cell").
					WithField("organization", orgID).
					WithField("dashboard", dashboard.Name).
					Error("Failed to register fixed-cell mapping (existing):", err)
			}
			logger.
				WithField("component", "fixed-cell").
				WithField("organization", orgID).
				WithField("dashboard", dashboard.Name).
				Debug("Fixed-cell dashboard already exists, ensured mapping")
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
				WithField("component", "fixed-cell").
				WithField("organization", orgID).
				WithField("dashboard", dashboard.Name).
				Error("Failed to add fixed-cell dashboard:", err)
			// Continue with other dashboards even if one fails
			continue
		}

		if err := mappingStore.Register(ctx, orgID, added.Name, added.ID); err != nil {
			logger.
				WithField("component", "fixed-cell").
				WithField("organization", orgID).
				WithField("dashboard", added.Name).
				Error("Failed to register fixed-cell mapping:", err)
		}

		logger.
			WithField("component", "fixed-cell").
			WithField("organization", orgID).
			WithField("dashboard", dashboard.Name).
			Info("Initialized fixed-cell dashboard")
	}

	return nil
}

// ApplyFixedCellToOrg updates the given org's fixed-cell dashboard from the latest template:
// - Templates, Version, UpdatedAt: replaced from template.
// - Cells: only cells with Type "component" are updated; only their Queries field is replaced from the template (matched by cell ID). All other cells and fields are left unchanged.
func ApplyFixedCellToOrg(
	ctx context.Context,
	orgID string,
	templateName string,
	dashboardsStore cloudhub.DashboardsStore,
	builtinStore *builtin.BinDashboardsStore,
	mappingStore cloudhub.FixedCellMappingStore,
	logger cloudhub.Logger,
) error {
	dashboardID, err := mappingStore.GetDashboardID(ctx, orgID, templateName)
	if err != nil {
		return err
	}

	dash, err := dashboardsStore.Get(ctx, dashboardID)
	if err != nil {
		logger.
			WithField("component", "fixed-cell").
			WithField("templateName", templateName).
			WithField("orgID", orgID).
			Error("Failed to get dashboard for apply:", err)
		return err
	}
	if dash.Organization != orgID {
		return cloudhub.ErrDashboardNotFound
	}

	template, err := builtinStore.Get(ctx, templateName)
	if err != nil {
		logger.
			WithField("component", "fixed-cell").
			WithField("templateName", templateName).
			Error("Failed to load fixed-cell:", err)
		return err
	}

	// Build map: template cell ID (i) -> queries (only for component type)
	templateQueriesByID := make(map[string][]cloudhub.DashboardQuery)
	for i := range template.Cells {
		c := &template.Cells[i]
		if c.Type == cloudhub.DashboardCellTypeComponent && c.ID != "" {
			templateQueriesByID[c.ID] = cloneDashboardQueries(c.Queries)
		}
	}

	// For org dashboard: only update Queries on cells with type "component", from template by cell ID (i)
	for i := range dash.Cells {
		c := &dash.Cells[i]
		if c.Type != cloudhub.DashboardCellTypeComponent {
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
			WithField("component", "fixed-cell").
			WithField("templateName", templateName).
			WithField("orgID", orgID).
			Error("Failed to update dashboard on apply:", err)
		return err
	}

	logger.
		WithField("component", "fixed-cell").
		WithField("templateName", templateName).
		WithField("orgID", orgID).
		Info("Applied fixed-cell (component cells: queries only) to org dashboard")
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
