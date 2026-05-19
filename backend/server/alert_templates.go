package server

import (
	"errors"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// AlertTemplatesGet returns every builtin alert template. Read-only — templates
// are embedded JSON assets, not user-managed rows.
func (s *Service) AlertTemplatesGet(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	templates, err := s.AlertTemplates.All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if templates == nil {
		templates = []cloudhub.AlertTemplate{}
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"alertTemplates": templates}, s.Logger)
}

// AlertTemplateID returns a single builtin alert template by ID.
func (s *Service) AlertTemplateID(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	t, err := s.AlertTemplates.Get(ctx, id)
	if err != nil {
		if errors.Is(err, cloudhub.ErrAlertTemplateNotFound) {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, t, s.Logger)
}
