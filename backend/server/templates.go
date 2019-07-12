package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/bouk/httprouter"
	cmp "github.com/snetsystems/cmp/backend"
	idgen "github.com/snetsystems/cmp/backend/id"
)

// ValidTemplateRequest checks if the request sent to the server is the correct format.
func ValidTemplateRequest(template *cmp.Template) error {
	switch template.Type {
	default:
		return fmt.Errorf("Unknown template type %s", template.Type)
	case "constant", "csv", "fieldKeys", "tagKeys", "tagValues", "measurements", "databases", "map", "influxql", "text":
	}

	for _, v := range template.Values {
		switch v.Type {
		default:
			return fmt.Errorf("Unknown template variable type %s", v.Type)
		case "csv", "map", "fieldKey", "tagKey", "tagValue", "measurement", "database", "constant", "influxql":
		}

		if template.Type == "map" && v.Key == "" {
			return fmt.Errorf("Templates of type 'map' require a 'key'")
		}
	}

	if template.Type == "influxql" && template.Query == nil {
		return fmt.Errorf("No query set for template of type 'influxql'")
	}

	return nil
}

type templateLinks struct {
	Self string `json:"self"` // Self link mapping to this resource
}

type templateResponse struct {
	cmp.Template
	Links templateLinks `json:"links"`
}

func newTemplateResponses(dID cmp.DashboardID, tmps []cmp.Template) []templateResponse {
	res := make([]templateResponse, len(tmps))
	for i, t := range tmps {
		res[i] = newTemplateResponse(dID, t)
	}
	return res
}

type templatesResponses struct {
	Templates []templateResponse `json:"templates"`
}

func newTemplateResponse(dID cmp.DashboardID, tmp cmp.Template) templateResponse {
	base := "/cmp/v1/dashboards"
	return templateResponse{
		Template: tmp,
		Links: templateLinks{
			Self: fmt.Sprintf("%s/%d/templates/%s", base, dID, tmp.ID),
		},
	}
}

// Templates returns all templates from a dashboard within the store
func (s *Service) Templates(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	d, err := s.Store.Dashboards(ctx).Get(ctx, cmp.DashboardID(id))
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	res := templatesResponses{
		Templates: newTemplateResponses(cmp.DashboardID(id), d.Templates),
	}
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewTemplate adds a template to an existing dashboard
func (s *Service) NewTemplate(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	dash, err := s.Store.Dashboards(ctx).Get(ctx, cmp.DashboardID(id))
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	var template cmp.Template
	if err := json.NewDecoder(r.Body).Decode(&template); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := ValidTemplateRequest(&template); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ids := idgen.UUID{}
	tid, err := ids.Generate()
	if err != nil {
		msg := fmt.Sprintf("Error creating template ID for dashboard %d: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}
	template.ID = cmp.TemplateID(tid)

	dash.Templates = append(dash.Templates, template)
	if err := s.Store.Dashboards(ctx).Update(ctx, dash); err != nil {
		msg := fmt.Sprintf("Error adding template %s to dashboard %d: %v", tid, id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	res := newTemplateResponse(dash.ID, template)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// TemplateID retrieves a specific template from a dashboard
func (s *Service) TemplateID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	dash, err := s.Store.Dashboards(ctx).Get(ctx, cmp.DashboardID(id))
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	tid := httprouter.GetParamFromContext(ctx, "tid")
	for _, t := range dash.Templates {
		if t.ID == cmp.TemplateID(tid) {
			res := newTemplateResponse(cmp.DashboardID(id), t)
			encodeJSON(w, http.StatusOK, res, s.Logger)
			return
		}
	}

	notFound(w, id, s.Logger)
}

// RemoveTemplate removes a specific template from an existing dashboard
func (s *Service) RemoveTemplate(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	dash, err := s.Store.Dashboards(ctx).Get(ctx, cmp.DashboardID(id))
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	tid := httprouter.GetParamFromContext(ctx, "tid")
	pos := -1
	for i, t := range dash.Templates {
		if t.ID == cmp.TemplateID(tid) {
			pos = i
			break
		}
	}
	if pos == -1 {
		notFound(w, id, s.Logger)
		return
	}

	dash.Templates = append(dash.Templates[:pos], dash.Templates[pos+1:]...)
	if err := s.Store.Dashboards(ctx).Update(ctx, dash); err != nil {
		msg := fmt.Sprintf("Error removing template %s from dashboard %d: %v", tid, id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ReplaceTemplate replaces a template entirely within an existing dashboard
func (s *Service) ReplaceTemplate(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	dash, err := s.Store.Dashboards(ctx).Get(ctx, cmp.DashboardID(id))
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	tid := httprouter.GetParamFromContext(ctx, "tid")
	pos := -1
	for i, t := range dash.Templates {
		if t.ID == cmp.TemplateID(tid) {
			pos = i
			break
		}
	}
	if pos == -1 {
		notFound(w, id, s.Logger)
		return
	}

	var template cmp.Template
	if err := json.NewDecoder(r.Body).Decode(&template); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := ValidTemplateRequest(&template); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	template.ID = cmp.TemplateID(tid)

	dash.Templates[pos] = template
	if err := s.Store.Dashboards(ctx).Update(ctx, dash); err != nil {
		msg := fmt.Sprintf("Error updating template %s in dashboard %d: %v", tid, id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	res := newTemplateResponse(cmp.DashboardID(id), template)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}
