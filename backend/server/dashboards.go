package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
)

// setFixedCellVersionInfo sets LatestVersion and UpdateAvailable on resp when d is a fixed-cell dashboard.
// getVersion returns the latest template version for a dashboard name (e.g. from BinDashboardsStore.GetVersion).
func setFixedCellVersionInfo(ctx context.Context, resp *dashboardResponse, d cloudhub.Dashboard, getVersion func(context.Context, string) string) {
	if d.Type != cloudhub.DashboardTypeBuiltin {
		return
	}
	latest := getVersion(ctx, d.Name)
	if latest == "" {
		return
	}
	resp.LatestVersion = latest
	// Update is available if: no version (legacy) or version differs from latest
	if d.Version == "" || d.Version != latest {
		resp.UpdateAvailable = true
	}
}

// getDashboardType returns DashboardTypeNormal if typeStr is empty, otherwise returns typeStr as-is.
// This ensures backward compatibility with existing dashboards that don't have a Type field.
func getDashboardType(typeStr string) string {
	if typeStr == "" {
		return cloudhub.DashboardTypeNormal
	}
	return typeStr
}

type dashboardLinks struct {
	Self      string `json:"self"`      // Self link mapping to this resource
	Cells     string `json:"cells"`     // Cells link to the cells endpoint
	Templates string `json:"templates"` // Templates link to the templates endpoint
}

type dashboardResponse struct {
	ID              cloudhub.DashboardID    `json:"id,string"`
	Cells           []dashboardCellResponse `json:"cells"`
	Templates       []templateResponse      `json:"templates"`
	Name            string                  `json:"name"`
	Organization    string                  `json:"organization"`
	Type            string                  `json:"type,omitempty"`
	Version         string                  `json:"version,omitempty"`         // Current version of the dashboard
	LatestVersion   string                  `json:"latestVersion,omitempty"`   // Latest version available (for fixed-cell dashboards)
	UpdateAvailable bool                    `json:"updateAvailable,omitempty"` // True if a newer template version is available
	IsDefault       bool                    `json:"isDefault,omitempty"`
	Shared          bool                    `json:"shared,omitempty"`      // True if this builtin template's cells may be imported into other dashboards
	Measurement     string                  `json:"measurement,omitempty"` // Measurement the template's cells read; clients hide the template when it is not collected
	Links           dashboardLinks          `json:"links"`
}

type getDashboardsResponse struct {
	Dashboards []*dashboardResponse `json:"dashboards"`
}

func newDashboardResponse(d cloudhub.Dashboard) *dashboardResponse {
	base := "/cloudhub/v1/dashboards"
	dd := AddQueryConfigs(DashboardDefaults(d))
	cells := newCellResponses(dd.ID, dd.Cells)
	templates := newTemplateResponses(dd.ID, dd.Templates)

	resp := &dashboardResponse{
		ID:           dd.ID,
		Name:         dd.Name,
		Cells:        cells,
		Templates:    templates,
		Organization: d.Organization,
		Type:         getDashboardType(d.Type),
		Version:      d.Version,
		IsDefault:    d.IsDefault,
		Shared:       d.Shared,
		Measurement:  d.Measurement,
		Links: dashboardLinks{
			Self:      fmt.Sprintf("%s/%d", base, dd.ID),
			Cells:     fmt.Sprintf("%s/%d/cells", base, dd.ID),
			Templates: fmt.Sprintf("%s/%d/templates", base, dd.ID),
		},
	}
	return resp
}

// Dashboards returns all dashboards within the store
// Query parameters:
//   - includeCells: if "true", includes cells in response (default: true)
//   - includeTemplates: if "true", includes templates in response (default: true)
func (s *Service) Dashboards(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	dashboards, err := s.Store.Dashboards(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, "Error loading dashboards", s.Logger)
		return
	}

	// Parse query parameters
	includeCells := r.URL.Query().Get("includeCells")
	includeTemplates := r.URL.Query().Get("includeTemplates")
	isDefaultFilter := r.URL.Query().Get("isDefault") == "true"

	// Default to true if not specified
	shouldIncludeCells := includeCells != "false"
	shouldIncludeTemplates := includeTemplates != "false"

	// Get fixed-cell template versions for comparison
	builtinStore := &builtin.BinDashboardsStore{Logger: s.Logger}
	templateVersions := builtinStore.GetAllVersions(ctx)

	res := getDashboardsResponse{
		Dashboards: []*dashboardResponse{},
	}

	if isDefaultFilter {
		var filtered []cloudhub.Dashboard
		for _, d := range dashboards {
			if d.IsDefault {
				filtered = append(filtered, d)
			}
		}
		if len(filtered) == 0 {
			for _, d := range dashboards {
				if d.Type == "" || d.Type == cloudhub.DashboardTypeNormal {
					filtered = append(filtered, d)
					break
				}
			}
		}
		dashboards = filtered
	}

	for _, dashboard := range dashboards {
		dashboardResp := newDashboardResponse(dashboard)
		getVersion := func(ctx context.Context, name string) string {
			return templateVersions[name]
		}
		setFixedCellVersionInfo(ctx, dashboardResp, dashboard, getVersion)

		// Conditionally exclude cells and templates based on query parameters
		if !shouldIncludeCells {
			dashboardResp.Cells = []dashboardCellResponse{}
		}
		if !shouldIncludeTemplates {
			dashboardResp.Templates = []templateResponse{}
		}

		res.Dashboards = append(res.Dashboards, dashboardResp)
	}
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// DashboardID returns a single specified dashboard
func (s *Service) DashboardID(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	e, err := s.Store.Dashboards(ctx).Get(ctx, cloudhub.DashboardID(id))
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	res := newDashboardResponse(e)
	builtinStore := &builtin.BinDashboardsStore{Logger: s.Logger}
	setFixedCellVersionInfo(ctx, res, e, builtinStore.GetVersion)

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// FixedCellDashboardByName returns the fixed-cell dashboard for the current org by name (e.g. host_page).
// GET /cloudhub/v1/fixed-cells/:name
// Returns the org's dashboard as stored. No auto-apply; the user must use the Update button (POST .../apply) to apply the latest template. This keeps Current version reflecting the real org state so the UI can show update availability (Current vs Latest).
func (s *Service) FixedCellDashboardByName(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || orgID == "" {
		Error(w, http.StatusBadRequest, "organization context required", s.Logger)
		return
	}
	name, err := paramStr("name", r)
	if err != nil || name == "" {
		Error(w, http.StatusBadRequest, "template name is required", s.Logger)
		return
	}

	dashboardID, err := s.Store.FixedCellMappingStore().GetDashboardID(ctx, orgID, name)
	if err != nil {
		if err == cloudhub.ErrDashboardNotFound {
			notFound(w, name, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	serverCtx := serverContext(ctx)
	e, err := s.Store.Dashboards(serverCtx).Get(ctx, dashboardID)
	if err != nil {
		notFound(w, name, s.Logger)
		return
	}
	if e.Organization != orgID {
		notFound(w, name, s.Logger)
		return
	}

	// Fixed Cell management UI must see all builtin cells (including hidden). Hidden means
	// "not shown on the dashboard layout", not "hide from the Fixed Cell list". So for this
	// endpoint we always include hidden cells; includeHidden=false is only for other callers
	// (e.g. normal dashboard view) that request this URL and want visible cells only.
	includeHidden := true
	if v := r.URL.Query().Get("includeHidden"); v == "false" || v == "0" {
		includeHidden = false
	}

	dashForResponse := e
	if !includeHidden {
		filtered := e
		filtered.Cells = make([]cloudhub.DashboardCell, 0, len(e.Cells))
		for _, c := range e.Cells {
			if c.Hidden {
				continue
			}
			filtered.Cells = append(filtered.Cells, c)
		}
		dashForResponse = filtered
	}

	templateStore := &builtin.BinDashboardsStore{Logger: s.Logger}
	res := newDashboardResponse(dashForResponse)
	setFixedCellVersionInfo(ctx, res, e, templateStore.GetVersion)

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewDashboard creates and returns a new dashboard object
func (s *Service) NewDashboard(w http.ResponseWriter, r *http.Request) {
	var dashboard cloudhub.Dashboard
	var err error
	if err := json.NewDecoder(r.Body).Decode(&dashboard); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	ctx := r.Context()
	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	if err := ValidDashboardRequest(&dashboard, defaultOrg.ID); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	if dashboard, err = s.Store.Dashboards(ctx).Add(r.Context(), dashboard); err != nil {
		msg := fmt.Errorf("Error storing dashboard %v: %v", dashboard, err)
		unknownErrorWithMessage(w, msg, s.Logger)
		return
	}

	// log registration
	msg := fmt.Sprintf(MsgDashboardCreated.String(), dashboard.Name)
	s.logRegistration(ctx, "Dashboards", msg)

	res := newDashboardResponse(dashboard)
	location(w, res.Links.Self)
	encodeJSON(w, http.StatusCreated, res, s.Logger)
}

// RemoveDashboard deletes a dashboard
func (s *Service) RemoveDashboard(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	dashboard, err := s.Store.Dashboards(ctx).Get(ctx, cloudhub.DashboardID(id))
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if err := s.Store.Dashboards(ctx).Delete(ctx, dashboard); err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	// If this was a fixed-cell (builtin) dashboard, remove the name→ID mapping so GET /fixed-cells/:name returns 404.
	if dashboard.Type == cloudhub.DashboardTypeBuiltin && dashboard.Name != "" && dashboard.Organization != "" {
		if unregErr := s.Store.FixedCellMappingStore().Unregister(ctx, dashboard.Organization, dashboard.Name); unregErr != nil {
			s.Logger.
				WithField("component", "fixed-cell").
				WithField("dashboard", dashboard.Name).
				WithField("organization", dashboard.Organization).
				Error("Dashboard deleted but failed to unregister fixed-cell mapping: ", unregErr)
		}
	}

	// log registration
	msg := fmt.Sprintf(MsgDashboardDeleted.String(), dashboard.Name)
	s.logRegistration(ctx, "Dashboards", msg)

	w.WriteHeader(http.StatusNoContent)
}

// ReplaceDashboard completely replaces a dashboard
func (s *Service) ReplaceDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idParam, err := paramID("id", r)
	if err != nil {
		msg := fmt.Sprintf("Could not parse dashboard ID: %s", err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}
	id := cloudhub.DashboardID(idParam)

	dashboard, err := s.Store.Dashboards(ctx).Get(ctx, id)
	if err != nil {
		Error(w, http.StatusNotFound, fmt.Sprintf("ID %d not found", id), s.Logger)
		return
	}

	var req cloudhub.Dashboard
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.ID = id

	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	if err := ValidDashboardRequest(&req, defaultOrg.ID); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// Preserve any hidden cells that already exist on the dashboard and are not already in the request
	// (e.g. client re-added a cell and sent it with hidden=false; do not append the same cell again).
	if len(dashboard.Cells) > 0 {
		reqIDs := make(map[string]struct{})
		for _, c := range req.Cells {
			if c.ID != "" {
				reqIDs[strings.TrimSpace(strings.ToLower(c.ID))] = struct{}{}
			}
		}
		for _, c := range dashboard.Cells {
			if c.Hidden && c.ID != "" {
				id := strings.TrimSpace(strings.ToLower(c.ID))
				if _, inReq := reqIDs[id]; !inReq {
					req.Cells = append(req.Cells, c)
					reqIDs[id] = struct{}{}
				}
			}
		}
	}

	// Shared and Measurement are template-derived; keep the stored values so a client that omits them cannot clear them.
	req.Shared = dashboard.Shared
	req.Measurement = dashboard.Measurement

	if err := s.Store.Dashboards(ctx).Update(ctx, req); err != nil {
		msg := fmt.Sprintf("Error updating dashboard ID %d: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	// log registration
	msg := fmt.Sprintf(MsgDashboardModified.String(), dashboard.Name)
	s.logRegistration(ctx, "Dashboards", msg)

	res := newDashboardResponse(req)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// UpdateDashboard completely updates the dashboard name, cells, and/or templates.
// Request body may include any combination of name, cells, and templates; each present field is applied.
func (s *Service) UpdateDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idParam, err := paramID("id", r)
	if err != nil {
		msg := fmt.Sprintf("Could not parse dashboard ID: %s", err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}
	id := cloudhub.DashboardID(idParam)

	orig, err := s.Store.Dashboards(ctx).Get(ctx, id)
	if err != nil {
		Error(w, http.StatusNotFound, fmt.Sprintf("ID %d not found", id), s.Logger)
		return
	}

	var req cloudhub.Dashboard
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.ID = id

	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	updated := false
	if req.Name != "" {
		orig.Name = req.Name
		updated = true
	}
	if len(req.Cells) > 0 {
		if err := ValidDashboardRequest(&req, defaultOrg.ID); err != nil {
			invalidData(w, err, s.Logger)
			return
		}

		// Preserve hidden cells that are not already in the request (client may have re-added a cell with hidden=false).
		if len(orig.Cells) > 0 {
			reqIDs := make(map[string]struct{})
			for _, c := range req.Cells {
				if c.ID != "" {
					reqIDs[strings.TrimSpace(strings.ToLower(c.ID))] = struct{}{}
				}
			}
			for _, c := range orig.Cells {
				if c.Hidden && c.ID != "" {
					id := strings.TrimSpace(strings.ToLower(c.ID))
					if _, inReq := reqIDs[id]; !inReq {
						req.Cells = append(req.Cells, c)
						reqIDs[id] = struct{}{}
					}
				}
			}
		}

		orig.Cells = req.Cells
		for i := range orig.Cells {
			if orig.Cells[i].ID != "" {
				orig.Cells[i].ID = strings.TrimSpace(strings.ToLower(orig.Cells[i].ID))
			}
		}
		updated = true
	}
	if req.Templates != nil {
		for i := range req.Templates {
			if err := ValidTemplateRequest(&req.Templates[i]); err != nil {
				invalidData(w, err, s.Logger)
				return
			}
		}
		orig.Templates = req.Templates
		updated = true
	}
	if req.IsDefault {
		// Ensure only one default per org: clear isDefault on all other dashboards
		allDashboards, err := s.Store.Dashboards(ctx).All(ctx)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		}
		for _, d := range allDashboards {
			if d.IsDefault && d.ID != id {
				d.IsDefault = false
				if err := s.Store.Dashboards(ctx).Update(ctx, d); err != nil {
					unknownErrorWithMessage(w, err, s.Logger)
					return
				}
			}
		}
		orig.IsDefault = true
		updated = true
	}
	if !updated {
		invalidData(w, fmt.Errorf("Update must include at least one of name, cells, templates, or isDefault"), s.Logger)
		return
	}

	if err := s.Store.Dashboards(ctx).Update(ctx, orig); err != nil {
		msg := fmt.Sprintf("Error updating dashboard ID %d: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	// log registration
	msg := fmt.Sprintf(MsgDashboardModified.String(), orig.Name)
	s.logRegistration(ctx, "Dashboards", msg)

	res := newDashboardResponse(orig)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// ValidDashboardRequest verifies that the dashboard cells have a query
func ValidDashboardRequest(d *cloudhub.Dashboard, defaultOrgID string) error {
	if d.Organization == "" {
		d.Organization = defaultOrgID
	}
	// Validate Type field: allow "", DashboardTypeNormal, or DashboardTypeBuiltin
	// If invalid, default to normal
	if d.Type != "" && d.Type != cloudhub.DashboardTypeNormal && d.Type != cloudhub.DashboardTypeBuiltin {
		d.Type = cloudhub.DashboardTypeNormal
	}
	for i, c := range d.Cells {
		if err := ValidDashboardCellRequest(&c); err != nil {
			return err
		}
		d.Cells[i] = c
	}
	for _, t := range d.Templates {
		if err := ValidTemplateRequest(&t); err != nil {
			return err
		}
	}
	(*d) = DashboardDefaults(*d)
	return nil
}

// DashboardDefaults updates the dashboard with the default values
// if none are specified
func DashboardDefaults(d cloudhub.Dashboard) (newDash cloudhub.Dashboard) {
	newDash.ID = d.ID
	newDash.Templates = d.Templates
	newDash.Name = d.Name
	newDash.Organization = d.Organization
	newDash.Type = getDashboardType(d.Type)
	newDash.Version = d.Version
	newDash.IsDefault = d.IsDefault
	newDash.Shared = d.Shared
	newDash.Measurement = d.Measurement
	newDash.Cells = make([]cloudhub.DashboardCell, len(d.Cells))

	for i, c := range d.Cells {
		CorrectWidthHeight(&c)
		newDash.Cells[i] = c
	}
	return
}

// AddQueryConfigs updates all the cells in the dashboard to have query config
// objects corresponding to their influxql queries.
func AddQueryConfigs(d cloudhub.Dashboard) (newDash cloudhub.Dashboard) {
	newDash.ID = d.ID
	newDash.Templates = d.Templates
	newDash.Name = d.Name
	newDash.Organization = d.Organization
	newDash.Type = d.Type
	newDash.Version = d.Version
	newDash.IsDefault = d.IsDefault
	newDash.Shared = d.Shared
	newDash.Measurement = d.Measurement
	newDash.Cells = make([]cloudhub.DashboardCell, len(d.Cells))

	for i, c := range d.Cells {
		AddQueryConfig(&c)
		newDash.Cells[i] = c
	}
	return
}

// fixedCellMeta is the response item for FixedCellList.
type fixedCellMeta struct {
	Name    string `json:"name"`
	Version string `json:"version,omitempty"`
}

// FixedCellList returns the list of available fixed-cell names (and version).
// GET /cloudhub/v1/fixed-cells
func (s *Service) FixedCellList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	builtinStore := &builtin.BinDashboardsStore{Logger: s.Logger}
	all, err := builtinStore.All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, "Error listing fixed-cells", s.Logger)
		return
	}
	list := make([]fixedCellMeta, 0, len(all))
	for _, d := range all {
		list = append(list, fixedCellMeta{Name: d.Name, Version: d.Version})
	}
	encodeJSON(w, http.StatusOK, struct {
		Templates []fixedCellMeta `json:"templates"`
	}{Templates: list}, s.Logger)
}

// GetFixedCell returns the original JSON template for a fixed-cell by name.
// GET /cloudhub/v1/fixed-cells/:name/template
func (s *Service) GetFixedCell(w http.ResponseWriter, r *http.Request) {
	name, err := paramStr("name", r)
	if err != nil {
		Error(w, http.StatusBadRequest, "Template name is required", s.Logger)
		return
	}

	ctx := r.Context()
	builtinStore := &builtin.BinDashboardsStore{
		Logger: s.Logger,
	}

	template, err := builtinStore.Get(ctx, name)
	if err != nil {
		if err == cloudhub.ErrDashboardNotFound {
			notFound(w, name, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, "Error loading fixed-cell", s.Logger)
		return
	}

	res := newDashboardResponse(template)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// ApplyFixedCell applies the latest fixed-cell to the current org's dashboard (component cells: queries only; templates and version updated).
// POST /cloudhub/v1/fixed-cells/:name/apply
func (s *Service) ApplyFixedCell(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || orgID == "" {
		Error(w, http.StatusBadRequest, "organization context required", s.Logger)
		return
	}

	name, err := paramStr("name", r)
	if err != nil || name == "" {
		Error(w, http.StatusBadRequest, "template name is required", s.Logger)
		return
	}

	serverCtx := serverContext(ctx)
	builtinStore := &builtin.BinDashboardsStore{Logger: s.Logger}
	err = ApplyFixedCellToOrg(
		serverCtx,
		orgID,
		name,
		s.Store.Dashboards(serverCtx),
		builtinStore,
		s.Store.FixedCellMappingStore(),
		s.Logger,
	)
	if err != nil {
		if err == cloudhub.ErrDashboardNotFound {
			notFound(w, name, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
