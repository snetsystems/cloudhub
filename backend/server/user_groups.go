// backend/server/user_groups.go
package server

import (
	"encoding/json"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/bouk/httprouter"
)

func (s *Service) UserGroupsGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, _ := hasOrganizationContext(ctx)
	groups, err := s.UserGroups.All(ctx, orgID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"userGroups": groups}, s.Logger)
}

func (s *Service) UserGroupCreate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req cloudhub.UserGroup
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if orgID, ok := hasOrganizationContext(ctx); ok {
		req.OrgID = orgID
	}
	g, err := s.UserGroups.Add(ctx, req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusCreated, g, s.Logger)
}

func (s *Service) UserGroupIDGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	g, err := s.UserGroups.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, g, s.Logger)
}

func (s *Service) UserGroupUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	if _, err := s.UserGroups.Get(ctx, id); err != nil {
		notFound(w, id, s.Logger)
		return
	}
	var req cloudhub.UserGroup
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.ID = id
	if err := s.UserGroups.Update(ctx, req); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	orgID, _ := hasOrganizationContext(ctx)
	if err := s.RegenerateRulesByUserGroup(ctx, orgID, req); err != nil {
		s.Logger.Error("UserGroupUpdate: regenerate rules:", err)
	}
	encodeJSON(w, http.StatusOK, req, s.Logger)
}

func (s *Service) UserGroupDelete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	existing, err := s.UserGroups.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	if err := s.UserGroups.Delete(ctx, id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	orgID, _ := hasOrganizationContext(ctx)
	if err := s.RegenerateRulesByUserGroup(ctx, orgID, existing); err != nil {
		s.Logger.Error("UserGroupDelete: regenerate rules:", err)
	}
	w.WriteHeader(http.StatusNoContent)
}

