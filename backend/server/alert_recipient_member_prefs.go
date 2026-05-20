package server

import (
	"encoding/json"
	"errors"
	"fmt"
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

type alertRecipientMemberPrefsBulkRequest struct {
	AlertRecipientMemberPrefs []struct {
		RecipientGroupMemberID string `json:"recipientGroupMemberId"`
		EmailEnabled           bool   `json:"emailEnabled"`
		EmailLevel             string `json:"emailLevel"`
		SMSEnabled             bool   `json:"smsEnabled"`
		SMSLevel               string `json:"smsLevel"`
		NotifyWeekdays         string `json:"notifyWeekdays"`
		NotifyStartHM          string `json:"notifyStartHm"`
		NotifyEndHM            string `json:"notifyEndHm"`
		EscalationSeconds      int    `json:"escalationSeconds"`
	} `json:"alertRecipientMemberPrefs"`
}

// AlertRecipientMemberPrefsBulkUpsert applies a batch of member prefs in one
// transaction. Each entry's recipientGroupMemberId must belong to the URL's
// :id group — cross-group updates are rejected to prevent privilege escalation
// via crafted memberIds. Members not present in the body keep their existing
// prefs (this matches the "save only what changed" UX).
func (s *Service) AlertRecipientMemberPrefsBulkUpsert(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	groupID, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	g, err := s.RecipientGroups.Get(ctx, groupID)
	if err != nil {
		if errors.Is(err, cloudhub.ErrRecipientGroupNotFound) {
			notFound(w, groupID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var req alertRecipientMemberPrefsBulkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	allowed := make(map[string]struct{}, len(g.Members))
	for _, m := range g.Members {
		allowed[m.ID] = struct{}{}
	}

	out := make([]cloudhub.AlertRecipientMemberPrefs, 0, len(req.AlertRecipientMemberPrefs))
	for _, item := range req.AlertRecipientMemberPrefs {
		if item.RecipientGroupMemberID == "" {
			invalidData(w, errors.New("recipientGroupMemberId is required"), s.Logger)
			return
		}
		if _, ok := allowed[item.RecipientGroupMemberID]; !ok {
			invalidData(w, fmt.Errorf("member %s does not belong to recipient group %s", item.RecipientGroupMemberID, groupID), s.Logger)
			return
		}
		if !validAlertLevel(item.EmailLevel) {
			invalidData(w, errors.New("emailLevel must be one of: '', all, warning, critical"), s.Logger)
			return
		}
		if !validAlertLevel(item.SMSLevel) {
			invalidData(w, errors.New("smsLevel must be one of: '', all, warning, critical"), s.Logger)
			return
		}
		out = append(out, cloudhub.AlertRecipientMemberPrefs{
			RecipientGroupMemberID: item.RecipientGroupMemberID,
			EmailEnabled:           item.EmailEnabled,
			EmailLevel:             item.EmailLevel,
			SMSEnabled:             item.SMSEnabled,
			SMSLevel:               item.SMSLevel,
			NotifyWeekdays:         item.NotifyWeekdays,
			NotifyStartHM:          item.NotifyStartHM,
			NotifyEndHM:            item.NotifyEndHM,
			EscalationSeconds:      item.EscalationSeconds,
		})
	}

	if err := s.AlertRecipientMemberPrefs.UpsertBulk(ctx, out); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.RegenerateRulesByRecipientGroup(ctx, g.OrgID, g); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	saved, err := s.AlertRecipientMemberPrefs.ByGroup(ctx, groupID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if saved == nil {
		saved = []cloudhub.AlertRecipientMemberPrefs{}
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"alertRecipientMemberPrefs": saved}, s.Logger)
}

// AlertRecipientMemberPrefsByGroup returns prefs for every member of the
// recipient group in one shot. Used by the alert UI to render per-member
// channel toggles without N+1 round-trips.
func (s *Service) AlertRecipientMemberPrefsByGroup(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	groupID, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	prefs, err := s.AlertRecipientMemberPrefs.ByGroup(ctx, groupID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if prefs == nil {
		prefs = []cloudhub.AlertRecipientMemberPrefs{}
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"alertRecipientMemberPrefs": prefs}, s.Logger)
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
