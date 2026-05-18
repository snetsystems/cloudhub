package server

import (
	"encoding/json"
	"errors"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type alertRecipientMemberPrefsRequest struct {
	EmailEnabled      bool   `json:"emailEnabled"`
	EmailLevel        string `json:"emailLevel"`
	SMSEnabled        bool   `json:"smsEnabled"`
	SMSLevel          string `json:"smsLevel"`
	NotifyWeekdays    string `json:"notifyWeekdays"`
	NotifyStartHM     string `json:"notifyStartHm"`
	NotifyEndHM       string `json:"notifyEndHm"`
	EscalationSeconds int    `json:"escalationSeconds"`
}

func validAlertLevel(level string) bool {
	switch level {
	case "", "all", "warning", "critical":
		return true
	}
	return false
}

// AlertRecipientMemberPrefsGet fetches alert preferences for a member.
func (s *Service) AlertRecipientMemberPrefsGet(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("memberId", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	p, err := s.AlertRecipientMemberPrefs.Get(ctx, id)
	if err != nil {
		Error(w, http.StatusNotFound, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, p, s.Logger)
}

// AlertRecipientMemberPrefsUpsert creates or updates a member's alert preferences.
func (s *Service) AlertRecipientMemberPrefsUpsert(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("memberId", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req alertRecipientMemberPrefsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if !validAlertLevel(req.EmailLevel) {
		invalidData(w, errors.New("emailLevel must be one of: '', all, warning, critical"), s.Logger)
		return
	}
	if !validAlertLevel(req.SMSLevel) {
		invalidData(w, errors.New("smsLevel must be one of: '', all, warning, critical"), s.Logger)
		return
	}

	prefs := cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: id,
		EmailEnabled:           req.EmailEnabled,
		EmailLevel:             req.EmailLevel,
		SMSEnabled:             req.SMSEnabled,
		SMSLevel:               req.SMSLevel,
		NotifyWeekdays:         req.NotifyWeekdays,
		NotifyStartHM:          req.NotifyStartHM,
		NotifyEndHM:            req.NotifyEndHM,
		EscalationSeconds:      req.EscalationSeconds,
	}
	if err := s.AlertRecipientMemberPrefs.Upsert(ctx, prefs); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	saved, err := s.AlertRecipientMemberPrefs.Get(ctx, id)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, saved, s.Logger)
}
