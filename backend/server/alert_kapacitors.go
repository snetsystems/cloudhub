package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// AlertKapacitorsGet gets all Kapacitors.
func (s *Service) AlertKapacitorsGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, _ := hasOrganizationContext(ctx)
	if err := s.backfillAlertKapacitorsFromLegacy(ctx, orgID); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	kapacitors, err := s.AlertKapacitors.All(ctx, orgID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"alertKapacitors": kapacitors}, s.Logger)
}

// BackfillAlertKapacitorsFromLegacy backfills Kapacitors from legacy.
func (s *Service) backfillAlertKapacitorsFromLegacy(ctx context.Context, orgID string) error {
	if orgID == "" || s.Store == nil || s.AlertKapacitors == nil || s.AlertKapacitorMappings == nil {
		return nil
	}

	servers, err := s.Store.Servers(ctx).All(ctx)
	if err != nil {
		return err
	}

	for _, srv := range servers {
		if srv.Type != "" || srv.Organization != orgID {
			continue
		}
		if _, err := s.AlertKapacitorMappings.GetAlertKapacitorID(ctx, srv.SrcID, srv.ID); err == nil {
			continue
		}
		if err := s.syncAlertKapacitorFromLegacy(ctx, srv); err != nil {
			return err
		}
	}

	return nil
}

// AlertKapacitorCreate creates a new Kapacitor.
func (s *Service) AlertKapacitorCreate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req cloudhub.AlertKapacitor
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if orgID, ok := hasOrganizationContext(ctx); ok {
		req.OrgID = orgID
	}
	k, err := s.AlertKapacitors.Add(ctx, req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusCreated, k, s.Logger)
}

// AlertKapacitorIDGet gets a Kapacitor by ID.
func (s *Service) AlertKapacitorIDGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	k, err := s.AlertKapacitors.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, k, s.Logger)
}

// AlertKapacitorUpdate updates a Kapacitor.
func (s *Service) AlertKapacitorUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	if _, err := s.AlertKapacitors.Get(ctx, id); err != nil {
		notFound(w, id, s.Logger)
		return
	}
	var req cloudhub.AlertKapacitor
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.ID = id
	if err := s.AlertKapacitors.Update(ctx, req); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, req, s.Logger)
}

// AlertKapacitorDelete deletes a Kapacitor.
func (s *Service) AlertKapacitorDelete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	if err := s.AlertKapacitors.Delete(ctx, id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
