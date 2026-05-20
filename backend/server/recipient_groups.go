package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// recipientGroupCreateRequest is the body for POST /recipient-groups.
// orgID is taken from the request context, not the body.
type recipientGroupCreateRequest struct {
	Name string `json:"name"`
}

// recipientGroupUpdateRequest is the body for PATCH /recipient-groups/:id.
// Only the name is mutable here.
type recipientGroupUpdateRequest struct {
	Name string `json:"name"`
}

// recipientGroupMemberRequest is the body for POST/PATCH
// /recipient-groups/:id/members[/...]. recipientGroupId comes from the URL.
type recipientGroupMemberRequest struct {
	UserID      string `json:"userId"`
	UserName    string `json:"userName"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phoneNumber"`
}

func isRecipientGroupNotFound(err error) bool {
	return errors.Is(err, cloudhub.ErrRecipientGroupNotFound)
}

// RecipientGroupsGet lists all recipient groups (with members) for the org.
//
// The handler is named RecipientGroupsGet (not RecipientGroups) to avoid
// colliding with the Service.RecipientGroups store field.
func (s *Service) RecipientGroupsGet(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}
	groups, err := s.RecipientGroups.All(ctx, orgID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if groups == nil {
		groups = []cloudhub.RecipientGroup{}
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"recipientGroups": groups}, s.Logger)
}

// NewRecipientGroup creates a new recipient group scoped to the org context.
func (s *Service) NewRecipientGroup(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}

	var req recipientGroupCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		invalidData(w, errors.New("name is required"), s.Logger)
		return
	}

	g, err := s.RecipientGroups.Add(ctx, cloudhub.RecipientGroup{
		OrgID: orgID,
		Name:  req.Name,
	})
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusCreated, g, s.Logger)
}

// RecipientGroupID fetches a single recipient group (with members) by ID.
func (s *Service) RecipientGroupID(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	g, err := s.RecipientGroups.Get(ctx, id)
	if err != nil {
		if isRecipientGroupNotFound(err) {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, g, s.Logger)
}

// UpdateRecipientGroup renames a recipient group.
func (s *Service) UpdateRecipientGroup(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	existing, err := s.RecipientGroups.Get(ctx, id)
	if err != nil {
		if isRecipientGroupNotFound(err) {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var req recipientGroupUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		invalidData(w, errors.New("name is required"), s.Logger)
		return
	}

	existing.Name = req.Name
	if err := s.RecipientGroups.Update(ctx, existing); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, existing, s.Logger)
}

// RemoveRecipientGroup soft-deletes a recipient group by ID.
func (s *Service) RemoveRecipientGroup(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	g, err := s.RecipientGroups.Get(ctx, id)
	if err != nil {
		if isRecipientGroupNotFound(err) {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if g.IsDefault {
		Error(w, http.StatusConflict, "default recipient group cannot be deleted", s.Logger)
		return
	}

	if err := s.RecipientGroups.Delete(ctx, id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// NewRecipientGroupMember adds a new member to the given recipient group.
func (s *Service) NewRecipientGroupMember(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	groupID, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	group, err := s.RecipientGroups.Get(ctx, groupID)
	if err != nil {
		if isRecipientGroupNotFound(err) {
			notFound(w, groupID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var req recipientGroupMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		invalidData(w, errors.New("email is required"), s.Logger)
		return
	}

	m, err := s.RecipientGroups.AddMember(ctx, cloudhub.RecipientGroupMember{
		RecipientGroupID: groupID,
		UserID:           strings.TrimSpace(req.UserID),
		UserName:         strings.TrimSpace(req.UserName),
		Email:            req.Email,
		PhoneNumber:      strings.TrimSpace(req.PhoneNumber),
	})
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.RegenerateRulesByRecipientGroup(ctx, group.OrgID, group); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusCreated, m, s.Logger)
}

// UpdateRecipientGroupMember updates a member's contact info.
// Only userName / email / phoneNumber are persisted by the store.
func (s *Service) UpdateRecipientGroupMember(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	groupID, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	memberID, err := paramStr("memberId", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	g, err := s.RecipientGroups.Get(ctx, groupID)
	if err != nil {
		if isRecipientGroupNotFound(err) {
			notFound(w, groupID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var current *cloudhub.RecipientGroupMember
	for i := range g.Members {
		if g.Members[i].ID == memberID {
			current = &g.Members[i]
			break
		}
	}
	if current == nil {
		notFound(w, memberID, s.Logger)
		return
	}

	var req recipientGroupMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	updated := *current
	if v := strings.TrimSpace(req.UserName); v != "" {
		updated.UserName = v
	}
	if v := strings.TrimSpace(req.Email); v != "" {
		updated.Email = v
	}
	if v := strings.TrimSpace(req.PhoneNumber); v != "" {
		updated.PhoneNumber = v
	}

	if err := s.RecipientGroups.UpdateMember(ctx, updated); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.RegenerateRulesByRecipientGroup(ctx, g.OrgID, g); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, updated, s.Logger)
}

// RemoveRecipientGroupMember soft-deletes a member from a recipient group.
func (s *Service) RemoveRecipientGroupMember(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	groupID, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	memberID, err := paramStr("memberId", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	g, err := s.RecipientGroups.Get(ctx, groupID)
	if err != nil {
		if isRecipientGroupNotFound(err) {
			notFound(w, groupID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	found := false
	for i := range g.Members {
		if g.Members[i].ID == memberID {
			found = true
			break
		}
	}
	if !found {
		notFound(w, memberID, s.Logger)
		return
	}
	if g.IsDefault {
		Error(w, http.StatusConflict, "default recipient group members cannot be deleted", s.Logger)
		return
	}

	if err := s.RecipientGroups.DeleteMember(ctx, memberID); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.RegenerateRulesByRecipientGroup(ctx, g.OrgID, g); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
