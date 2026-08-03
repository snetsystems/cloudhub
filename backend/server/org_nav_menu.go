package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type orgNavMenuResponse struct {
	ID         string                    `json:"id,omitempty"`
	OrgID      string                    `json:"orgId"`
	NavItems   []cloudhub.OrgNavMenuItem `json:"navItems"`
	IsDegraded bool                      `json:"isDegraded"`
	Warning    string                    `json:"warning,omitempty"`
	CreatedAt  string                    `json:"createdAt,omitempty"`
	UpdatedAt  string                    `json:"updatedAt,omitempty"`
}

func newOrgNavMenuResponse(m *cloudhub.OrgNavMenu) *orgNavMenuResponse {
	return &orgNavMenuResponse{
		ID:         m.ID,
		OrgID:      m.OrgID,
		NavItems:   m.NavItems,
		IsDegraded: m.IsDegraded,
		Warning:    m.Warning,
		CreatedAt:  m.CreatedAt.Format(http.TimeFormat),
		UpdatedAt:  m.UpdatedAt.Format(http.TimeFormat),
	}
}

type orgNavMenuUpsertRequest struct {
	NavItems []cloudhub.OrgNavMenuItem `json:"navItems"`
}

// GetOrgNavMenu returns the SideNav menu configuration for a specific organization.
// GET /cloudhub/v1/organizations/:oid/nav-menu
func (s *Service) GetOrgNavMenu(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, err := paramStr("oid", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	store := s.Store.OrgNavMenu(ctx)
	menu, err := store.GetByOrgID(ctx, orgID)
	if err != nil {
		if errors.Is(err, cloudhub.ErrOrgNavMenuNotFound) {
			notFound(w, orgID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, newOrgNavMenuResponse(menu), s.Logger)
}

// UpdateOrgNavMenu creates or updates the SideNav menu configuration for an organization (SuperAdmin only).
// POST /cloudhub/v1/organizations/:oid/nav-menu
// PUT /cloudhub/v1/organizations/:oid/nav-menu
func (s *Service) UpdateOrgNavMenu(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, err := paramStr("oid", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req orgNavMenuUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, fmt.Errorf("invalid json request: %w", err), s.Logger)
		return
	}

	menu := &cloudhub.OrgNavMenu{
		OrgID:    orgID,
		NavItems: req.NavItems,
	}

	store := s.Store.OrgNavMenu(ctx)
	updated, err := store.Upsert(ctx, menu)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, newOrgNavMenuResponse(updated), s.Logger)
}

// PatchOrgNavMenu selectively updates specific SideNav menu items for an organization (SuperAdmin only).
// PATCH /cloudhub/v1/organizations/:oid/nav-menu
func (s *Service) PatchOrgNavMenu(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, err := paramStr("oid", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req orgNavMenuUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, fmt.Errorf("invalid json request: %w", err), s.Logger)
		return
	}

	store := s.Store.OrgNavMenu(ctx)
	updated, err := store.Patch(ctx, orgID, req.NavItems)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, newOrgNavMenuResponse(updated), s.Logger)
}

// DeleteOrgNavMenu deletes (resets) the SideNav menu configuration for an organization (SuperAdmin only).
// DELETE /cloudhub/v1/organizations/:oid/nav-menu
func (s *Service) DeleteOrgNavMenu(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, err := paramStr("oid", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	store := s.Store.OrgNavMenu(ctx)
	err = store.Delete(ctx, orgID)
	if err != nil {
		if errors.Is(err, cloudhub.ErrOrgNavMenuNotFound) {
			notFound(w, orgID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetMasterNavMenu returns ALL system-wide master navigation menu items including soft-deleted ones (SuperAdmin only).
// deleteYN=true items are included so SuperAdmin can see what was deleted and restore if needed.
// GET /cloudhub/v1/nav-menu/master
func (s *Service) GetMasterNavMenu(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	store := s.Store.OrgNavMenu(ctx)
	items, err := store.GetMasterMenu(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := struct {
		NavItems []cloudhub.MasterNavMenuItem `json:"navItems"`
	}{
		NavItems: items,
	}
	if res.NavItems == nil {
		res.NavItems = []cloudhub.MasterNavMenuItem{}
	}
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// UpdateMasterNavMenu updates the system-wide master navigation menu items in nav_menu_items (SuperAdmin only).
// PUT /cloudhub/v1/nav-menu/master
// POST /cloudhub/v1/nav-menu/master
func (s *Service) UpdateMasterNavMenu(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req orgNavMenuUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, fmt.Errorf("invalid json request: %w", err), s.Logger)
		return
	}

	store := s.Store.OrgNavMenu(ctx)
	if err := store.UpdateMasterMenu(ctx, req.NavItems); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeleteMasterNavMenuItem soft-deletes a system-wide master navigation menu item (SuperAdmin only).
// DELETE /cloudhub/v1/nav-menu/master/:id
func (s *Service) DeleteMasterNavMenuItem(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	itemID, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	store := s.Store.OrgNavMenu(ctx)
	if err := store.DeleteMasterMenuItem(ctx, itemID); err != nil {
		if errors.Is(err, cloudhub.ErrOrgNavMenuNotFound) {
			notFound(w, itemID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
