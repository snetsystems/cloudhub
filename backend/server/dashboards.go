package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
)

// setBuiltinVersionInfo sets LatestVersion and UpdateAvailable on resp when d is a builtin dashboard.
// getVersion returns the latest builtin version for a dashboard name (e.g. from BinDashboardsStore.GetVersion).
func setBuiltinVersionInfo(resp *dashboardResponse, d cloudhub.Dashboard, getVersion func(context.Context, string) string, ctx context.Context) {
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
	LatestVersion   string                  `json:"latestVersion,omitempty"`   // Latest version available (for builtin dashboards)
	UpdateAvailable bool                    `json:"updateAvailable,omitempty"` // True if a newer version is available
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

	return &dashboardResponse{
		ID:           dd.ID,
		Name:         dd.Name,
		Cells:        cells,
		Templates:    templates,
		Organization: d.Organization,
		Type:         getDashboardType(d.Type),
		Version:      d.Version,
		Links: dashboardLinks{
			Self:      fmt.Sprintf("%s/%d", base, dd.ID),
			Cells:     fmt.Sprintf("%s/%d/cells", base, dd.ID),
			Templates: fmt.Sprintf("%s/%d/templates", base, dd.ID),
		},
	}
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

	// Default to true if not specified
	shouldIncludeCells := includeCells != "false"
	shouldIncludeTemplates := includeTemplates != "false"

	// Get builtin dashboard versions for comparison
	builtinStore := &builtin.BinDashboardsStore{Logger: s.Logger}
	builtinVersions := builtinStore.GetAllVersions(ctx)

	res := getDashboardsResponse{
		Dashboards: []*dashboardResponse{},
	}

	for _, dashboard := range dashboards {
		dashboardResp := newDashboardResponse(dashboard)
		getVersion := func(ctx context.Context, name string) string {
			return builtinVersions[name]
		}
		setBuiltinVersionInfo(dashboardResp, dashboard, getVersion, ctx)

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
	setBuiltinVersionInfo(res, e, builtinStore.GetVersion, ctx)

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// TemplateDashboardByName returns the builtin dashboard for the current org by name (e.g. host_page).
// GET /cloudhub/v1/templates/:name
func (s *Service) TemplateDashboardByName(w http.ResponseWriter, r *http.Request) {
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

	dashboardID, err := s.Store.BuiltinDashboardMappingStore().GetDashboardID(ctx, orgID, name)
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

	res := newDashboardResponse(e)
	builtinStore := &builtin.BinDashboardsStore{Logger: s.Logger}
	setBuiltinVersionInfo(res, e, builtinStore.GetVersion, ctx)

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
		orig.Cells = req.Cells
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
	if !updated {
		invalidData(w, fmt.Errorf("Update must include at least one of name, cells, or templates"), s.Logger)
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
	newDash.Cells = make([]cloudhub.DashboardCell, len(d.Cells))

	for i, c := range d.Cells {
		AddQueryConfig(&c)
		newDash.Cells[i] = c
	}
	return
}

// BuiltinDashboardTemplate returns the original JSON template for a builtin dashboard by file name
// GET /cloudhub/v1/builtin/dashboards/:name/template
// The name parameter should be the dashboard file name without extension (e.g., "hostpage" for "hostpage.json")
func (s *Service) BuiltinDashboardTemplate(w http.ResponseWriter, r *http.Request) {
	name, err := paramStr("name", r)
	if err != nil {
		Error(w, http.StatusBadRequest, "Dashboard name is required", s.Logger)
		return
	}

	ctx := r.Context()
	builtinStore := &builtin.BinDashboardsStore{
		Logger: s.Logger,
	}

	// Get template by dashboard name (unique identifier, not filename)
	template, err := builtinStore.Get(ctx, name)
	if err != nil {
		if err == cloudhub.ErrDashboardNotFound {
			notFound(w, name, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, "Error loading builtin dashboard template", s.Logger)
		return
	}

	// Return the template as-is (without organization or ID set)
	res := newDashboardResponse(template)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}
