package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/organizations"
	"github.com/snetsystems/cloudhub/backend/roles"
)

type organizationRequest struct {
	Name        string `json:"name"`
	DefaultRole string `json:"defaultRole"`
}

func (r *organizationRequest) ValidCreate() error {
	if r.Name == "" {
		return fmt.Errorf("Name required on CloudHub Organization request body")
	}

	return r.ValidDefaultRole()
}

func (r *organizationRequest) ValidUpdate() error {
	if r.Name == "" && r.DefaultRole == "" {
		return fmt.Errorf("No fields to update")
	}

	if r.DefaultRole != "" {
		return r.ValidDefaultRole()
	}

	return nil
}

func (r *organizationRequest) ValidDefaultRole() error {
	if r.DefaultRole == "" {
		r.DefaultRole = roles.MemberRoleName
	}

	switch r.DefaultRole {
	case roles.MemberRoleName, roles.ViewerRoleName, roles.EditorRoleName, roles.AdminRoleName:
		return nil
	default:
		return fmt.Errorf("default role must be member, viewer, editor, or admin")
	}
}

type organizationResponse struct {
	Links selfLinks `json:"links"`
	cloudhub.Organization
}

func newOrganizationResponse(o *cloudhub.Organization) *organizationResponse {
	if o == nil {
		o = &cloudhub.Organization{}
	}
	return &organizationResponse{
		Organization: *o,
		Links: selfLinks{
			Self: fmt.Sprintf("/cloudhub/v1/organizations/%s", o.ID),
		},
	}
}

type organizationsResponse struct {
	Links         selfLinks               `json:"links"`
	Organizations []*organizationResponse `json:"organizations"`
}

func newOrganizationsResponse(orgs []cloudhub.Organization) *organizationsResponse {
	orgsResp := make([]*organizationResponse, len(orgs))
	for i, org := range orgs {
		orgsResp[i] = newOrganizationResponse(&org)
	}
	return &organizationsResponse{
		Organizations: orgsResp,
		Links: selfLinks{
			Self: "/cloudhub/v1/organizations",
		},
	}
}

// Organizations retrieves all organizations from store
func (s *Service) Organizations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	orgs, err := s.Store.Organizations(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	res := newOrganizationsResponse(orgs)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewOrganization adds a new organization to store
func (s *Service) NewOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	org := &cloudhub.Organization{
		Name:        req.Name,
		DefaultRole: req.DefaultRole,
	}

	res, err := s.Store.Organizations(ctx).Add(ctx, org)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	// Now that the organization was created, add the user
	// making the request to the organization
	user, ok := hasUserContext(ctx)
	if !ok {
		// Best attempt at cleanup the organization if there were any errors
		_ = s.Store.Organizations(ctx).Delete(ctx, res)
		Error(w, http.StatusInternalServerError, "failed to retrieve user from context", s.Logger)
		return
	}

	user.Roles = []cloudhub.Role{
		{
			Organization: res.ID,
			Name:         roles.AdminRoleName,
		},
	}

	orgCtx := context.WithValue(ctx, organizations.ContextKey, res.ID)
	_, err = s.Store.Users(orgCtx).Add(orgCtx, user)
	if err != nil {
		// Best attempt at cleanup the organization if there were any errors adding user to org
		_ = s.Store.Organizations(ctx).Delete(ctx, res)
		s.Logger.Error("failed to add user to organization", err.Error())
		Error(w, http.StatusInternalServerError, "failed to add user to organization", s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgOrganizationCreated.String(), res.Name)
	s.logRegistration(ctx, "Organizations", msg)

	co := newOrganizationResponse(res)
	location(w, co.Links.Self)
	encodeJSON(w, http.StatusCreated, co, s.Logger)
}

// OrganizationID retrieves a organization with ID from store
func (s *Service) OrganizationID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	id := httprouter.GetParamFromContext(ctx, "oid")

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	res := newOrganizationResponse(org)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// UpdateOrganization updates an organization in the organizations store
func (s *Service) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	id := httprouter.GetParamFromContext(ctx, "oid")

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	if req.Name != "" {
		org.Name = req.Name
	}

	if req.DefaultRole != "" {
		org.DefaultRole = req.DefaultRole
	}

	err = s.Store.Organizations(ctx).Update(ctx, org)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgOrganizationModified.String(), org.Name)
	s.logRegistration(ctx, "Organizations", msg)

	res := newOrganizationResponse(org)
	location(w, res.Links.Self)
	encodeJSON(w, http.StatusOK, res, s.Logger)

}

// RemoveOrganization removes an organization in the organizations store
func (s *Service) RemoveOrganization(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParamFromContext(ctx, "oid")

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusNotFound, err.Error(), s.Logger)
		return
	}
	devices, err := s.Store.NetworkDevice(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	for _, device := range devices {
		if device.Organization == org.ID {
			msg := "The organization cannot be deleted because there are registered devices associated with it."
			Error(w, http.StatusConflict, msg, s.Logger)
			return
		}
	}

	if err := s.Store.Organizations(ctx).Delete(ctx, org); err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgOrganizationDeleted.String(), org.Name)
	s.logRegistration(ctx, "Organizations", msg)

	w.WriteHeader(http.StatusNoContent)
}

// OrganizationExists checks if an organization with the given organization ID exists in the store.
func (s *Service) OrganizationExists(ctx context.Context, orgID string) error {
	if _, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &orgID}); err != nil {
		return fmt.Errorf("organization does not exist")
	}
	return nil
}

// OrganizationNameByID retrieves the name of the organization given its ID.
func (s *Service) OrganizationNameByID(ctx context.Context, orgID string) (string, error) {
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &orgID})
	if err != nil {
		return "", fmt.Errorf("organization does not exist")
	}
	return org.Name, nil
}
