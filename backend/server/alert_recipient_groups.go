package server

import (
	"encoding/json"
	"errors"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type alertRecipientGroupRequest struct {
	SuppressionEnabled       bool `json:"suppressionEnabled"`
	SuppressionWindowSeconds int  `json:"suppressionWindowSeconds"`
	SuppressionCount         int  `json:"suppressionCount"`
	SuppressionPauseSeconds  int  `json:"suppressionPauseSeconds"`
}

// AlertRecipientGroupGet fetches the alert-domain extension for a recipient group.
func (s *Service) AlertRecipientGroupGet(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ext, err := s.AlertRecipientGroups.Get(ctx, id)
	if err != nil {
		Error(w, http.StatusNotFound, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, ext, s.Logger)
}

// AlertRecipientGroupUpsert creates or updates the alert-domain extension for
// a recipient group. The presence of an extension row marks the group as
// participating in the alert domain.
func (s *Service) AlertRecipientGroupUpsert(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	if _, err := s.RecipientGroups.Get(ctx, id); err != nil {
		if isRecipientGroupNotFound(err) {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var req alertRecipientGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if req.SuppressionEnabled && req.SuppressionWindowSeconds <= 0 {
		invalidData(w, errors.New("suppressionWindowSeconds must be > 0 when suppressionEnabled is true"), s.Logger)
		return
	}

	ext := cloudhub.AlertRecipientGroup{
		RecipientGroupID:         id,
		SuppressionEnabled:       req.SuppressionEnabled,
		SuppressionWindowSeconds: req.SuppressionWindowSeconds,
		SuppressionCount:         req.SuppressionCount,
		SuppressionPauseSeconds:  req.SuppressionPauseSeconds,
	}
	if err := s.AlertRecipientGroups.Upsert(ctx, ext); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	saved, err := s.AlertRecipientGroups.Get(ctx, id)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, saved, s.Logger)
}

// AlertRecipientGroupDelete removes the alert-domain extension row, marking
// the group as no longer participating in the alert domain.
func (s *Service) AlertRecipientGroupDelete(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	if err := s.AlertRecipientGroups.Delete(ctx, id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
