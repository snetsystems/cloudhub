package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/bouk/httprouter"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/oauth2"
)

func (s *Service) mapPrincipalToSuperAdmin(p oauth2.Principal) bool {
	if p.Issuer != "auth0" {
		return false
	}

	groups := strings.Split(p.Group, ",")
	superAdmin := false
	for _, group := range groups {
		if group != "" && group == s.SuperAdminProviderGroups.auth0 {
			superAdmin = true
			break
		}
	}
	return superAdmin
}

func (s *Service) mapPrincipalToRoles(ctx context.Context, p oauth2.Principal) ([]cmp.Role, error) {
	mappings, err := s.Store.Mappings(ctx).All(ctx)
	if err != nil {
		return nil, err
	}
	roles := []cmp.Role{}
MappingsLoop:
	for _, mapping := range mappings {
		if applyMapping(mapping, p) {
			org, err := s.Store.Organizations(ctx).Get(ctx, cmp.OrganizationQuery{ID: &mapping.Organization})
			if err != nil {
				continue MappingsLoop
			}

			for _, role := range roles {
				if role.Organization == org.ID {
					continue MappingsLoop
				}
			}
			roles = append(roles, cmp.Role{Organization: org.ID, Name: org.DefaultRole})
		}
	}

	return roles, nil
}

func applyMapping(m cmp.Mapping, p oauth2.Principal) bool {
	switch m.Provider {
	case cmp.MappingWildcard, p.Issuer:
	default:
		return false
	}

	switch m.Scheme {
	case cmp.MappingWildcard, "oauth2":
	default:
		return false
	}

	if m.ProviderOrganization == cmp.MappingWildcard {
		return true
	}

	groups := strings.Split(p.Group, ",")

	return matchGroup(m.ProviderOrganization, groups)
}

func matchGroup(match string, groups []string) bool {
	for _, group := range groups {
		if match == group {
			return true
		}
	}

	return false
}

type mappingsRequest cmp.Mapping

// Valid determines if a mapping request is valid
func (m *mappingsRequest) Valid() error {
	if m.Provider == "" {
		return fmt.Errorf("mapping must specify provider")
	}
	if m.Scheme == "" {
		return fmt.Errorf("mapping must specify scheme")
	}
	if m.ProviderOrganization == "" {
		return fmt.Errorf("mapping must specify group")
	}

	return nil
}

type mappingResponse struct {
	Links selfLinks `json:"links"`
	cmp.Mapping
}

func newMappingResponse(m cmp.Mapping) *mappingResponse {

	return &mappingResponse{
		Links: selfLinks{
			Self: fmt.Sprintf("/cmp/v1/mappings/%s", m.ID),
		},
		Mapping: m,
	}
}

type mappingsResponse struct {
	Links    selfLinks          `json:"links"`
	Mappings []*mappingResponse `json:"mappings"`
}

func newMappingsResponse(ms []cmp.Mapping) *mappingsResponse {
	mappings := []*mappingResponse{}
	for _, m := range ms {
		mappings = append(mappings, newMappingResponse(m))
	}
	return &mappingsResponse{
		Links: selfLinks{
			Self: "/cmp/v1/mappings",
		},
		Mappings: mappings,
	}
}

// Mappings retrives all mappings
func (s *Service) Mappings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	mappings, err := s.Store.Mappings(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, "failed to retrieve mappings from database", s.Logger)
		return
	}

	res := newMappingsResponse(mappings)

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewMapping adds a new mapping
func (s *Service) NewMapping(w http.ResponseWriter, r *http.Request) {
	var req mappingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.Valid(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	// validate that the organization exists
	if !s.organizationExists(ctx, req.Organization) {
		invalidData(w, fmt.Errorf("organization does not exist"), s.Logger)
		return
	}

	mapping := &cmp.Mapping{
		Organization:         req.Organization,
		Scheme:               req.Scheme,
		Provider:             req.Provider,
		ProviderOrganization: req.ProviderOrganization,
	}

	m, err := s.Store.Mappings(ctx).Add(ctx, mapping)
	if err != nil {
		Error(w, http.StatusInternalServerError, "failed to add mapping to database", s.Logger)
		return
	}

	cu := newMappingResponse(*m)
	location(w, cu.Links.Self)
	encodeJSON(w, http.StatusCreated, cu, s.Logger)
}

// UpdateMapping updates a mapping
func (s *Service) UpdateMapping(w http.ResponseWriter, r *http.Request) {
	var req mappingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.Valid(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	// validate that the organization exists
	if !s.organizationExists(ctx, req.Organization) {
		invalidData(w, fmt.Errorf("organization does not exist"), s.Logger)
		return
	}

	mapping := &cmp.Mapping{
		ID:                   req.ID,
		Organization:         req.Organization,
		Scheme:               req.Scheme,
		Provider:             req.Provider,
		ProviderOrganization: req.ProviderOrganization,
	}

	err := s.Store.Mappings(ctx).Update(ctx, mapping)
	if err != nil {
		Error(w, http.StatusInternalServerError, "failed to update mapping in database", s.Logger)
		return
	}

	cu := newMappingResponse(*mapping)
	location(w, cu.Links.Self)
	encodeJSON(w, http.StatusOK, cu, s.Logger)
}

// RemoveMapping removes a mapping
func (s *Service) RemoveMapping(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParamFromContext(ctx, "id")

	m, err := s.Store.Mappings(ctx).Get(ctx, id)
	if err == cmp.ErrMappingNotFound {
		Error(w, http.StatusNotFound, err.Error(), s.Logger)
		return
	}

	if err != nil {
		Error(w, http.StatusInternalServerError, "failed to retrieve mapping from database", s.Logger)
		return
	}

	if err := s.Store.Mappings(ctx).Delete(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError, "failed to remove mapping from database", s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) organizationExists(ctx context.Context, orgID string) bool {
	if _, err := s.Store.Organizations(ctx).Get(ctx, cmp.OrganizationQuery{ID: &orgID}); err != nil {
		return false
	}

	return true
}
