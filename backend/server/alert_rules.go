// backend/server/alert_rules.go
package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/bouk/httprouter"
	"github.com/google/uuid"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	kapackage "github.com/snetsystems/cloudhub/backend/kapacitor"
)

type alertGroupTestNotificationRequest struct {
	KapacitorID  string   `json:"kapacitorId,omitempty"`
	UserGroupIDs []string `json:"userGroupIds,omitempty"`
	Title        string   `json:"title"`
	Message      string   `json:"message"`
	Recipients   []string `json:"recipients,omitempty"`
}

type alertGroupTestNotificationResponse struct {
	ResolvedUserGroups int      `json:"resolvedUserGroups"`
	ResolvedRecipients []string `json:"resolvedRecipients"`
	SentCount          int      `json:"sentCount"`
}

// kapacitorSMTPSender is overridable in tests to bypass real HTTP calls.
var kapacitorSMTPSender = sendViaKapacitorSMTPServiceTest

func (s *Service) AlertGroupRulesGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, _ := hasOrganizationContext(ctx)
	rules, err := s.AlertGroupRules.All(ctx, orgID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	for i := range rules {
		recipients, err := s.resolveRuleRecipients(ctx, rules[i])
		if err != nil {
			s.Logger.Error("AlertGroupRulesGet: resolve recipients:", err)
			continue
		}
		hostnames, _ := s.AlertGroupRules.Hostnames(ctx, rules[i].ID)
		rules[i].Tickscript, _ = kapackage.AlertGroupRuleTICKScript(rules[i], recipients, hostnames)
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"alertGroupRules": rules}, s.Logger)
}

func (s *Service) AlertGroupRuleCreate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req cloudhub.AlertGroupRule
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if orgID, ok := hasOrganizationContext(ctx); ok {
		req.OrgID = orgID
	}
	if err := s.validateAlertGroupKapacitor(ctx, req.OrgID, req.KapacitorID); err != nil {
		if errors.Is(err, errAlertKapacitorStoreUnavailable) {
			internalServerError(w, err, s.Logger)
			return
		}
		invalidData(w, err, s.Logger)
		return
	}
	if err := validateAlertGroupRuleInput(req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	rule, err := s.AlertGroupRules.Add(ctx, req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	// Persist host/user_group associations alongside the rule itself.
	if err := s.AlertGroupRules.SetHosts(ctx, rule.ID, req.Hostnames); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetUserGroups(ctx, rule.ID, req.UserGroupIDs); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	rule.Hostnames = req.Hostnames
	rule.UserGroupIDs = req.UserGroupIDs
	rule.Recipients = req.Recipients
	recipients, err := s.resolveRuleRecipients(ctx, rule)
	if err != nil {
		s.Logger.Error("AlertGroupRuleCreate: resolve recipients:", err)
		internalServerError(w, err, s.Logger)
		return
	}
	if err := s.syncKapacitorTask(ctx, rule, recipients); err != nil {
		s.Logger.Error("AlertGroupRuleCreate: sync kapacitor task:", err)
		internalServerError(w, err, s.Logger)
		return
	}
	hostnames, _ := s.AlertGroupRules.Hostnames(ctx, rule.ID)
	rule.Tickscript, _ = kapackage.AlertGroupRuleTICKScript(rule, recipients, hostnames)
	encodeJSON(w, http.StatusCreated, rule, s.Logger)
}

func (s *Service) AlertGroupRuleIDGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	rule, err := s.AlertGroupRules.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	recipients, err := s.resolveRuleRecipients(ctx, rule)
	if err != nil {
		s.Logger.Error("AlertGroupRuleIDGet: resolve recipients:", err)
	}
	hostnames, _ := s.AlertGroupRules.Hostnames(ctx, rule.ID)
	rule.Tickscript, _ = kapackage.AlertGroupRuleTICKScript(rule, recipients, hostnames)
	encodeJSON(w, http.StatusOK, rule, s.Logger)
}

func (s *Service) AlertGroupRuleUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	existing, err := s.AlertGroupRules.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	// PATCH semantics: existing as base and only overwrite with keys in the request body.
	// Unsent fields are kept as existing values.
	req := existing
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.ID = id
	req.OrgID = existing.OrgID
	if err := s.validateAlertGroupKapacitor(ctx, existing.OrgID, req.KapacitorID); err != nil {
		if errors.Is(err, errAlertKapacitorStoreUnavailable) {
			internalServerError(w, err, s.Logger)
			return
		}
		invalidData(w, err, s.Logger)
		return
	}
	if err := validateAlertGroupRuleInput(req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	if err := s.AlertGroupRules.Update(ctx, req); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetHosts(ctx, id, req.Hostnames); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetUserGroups(ctx, id, req.UserGroupIDs); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	recipients, err := s.resolveRuleRecipients(ctx, req)
	if err != nil {
		s.Logger.Error("AlertGroupRuleUpdate: resolve recipients:", err)
		internalServerError(w, err, s.Logger)
		return
	}
	if err := s.syncKapacitorTask(ctx, req, recipients); err != nil {
		s.Logger.Error("AlertGroupRuleUpdate: sync kapacitor task:", err)
		internalServerError(w, err, s.Logger)
		return
	}
	hostnames, _ := s.AlertGroupRules.Hostnames(ctx, id)
	req.Tickscript, _ = kapackage.AlertGroupRuleTICKScript(req, recipients, hostnames)
	encodeJSON(w, http.StatusOK, req, s.Logger)
}

// AlertGroupRuleTestNotification sends a test notification for an alert group rule.
func (s *Service) AlertGroupRuleTestNotification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, _ := hasOrganizationContext(ctx)

	var req alertGroupTestNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if req.Title == "" {
		invalidData(w, fmt.Errorf("title is required"), s.Logger)
		return
	}
	if req.Message == "" {
		invalidData(w, fmt.Errorf("message is required"), s.Logger)
		return
	}
	if req.KapacitorID == "" {
		invalidData(w, fmt.Errorf("kapacitorId is required"), s.Logger)
		return
	}
	userGroups, err := s.resolveDraftAlertGroupUserGroups(ctx, orgID, req.UserGroupIDs)
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}
	resp, err := s.sendAlertGroupTestNotification(ctx, orgID, req.KapacitorID, userGroups, req.Title, req.Message, req.Recipients)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, resp, s.Logger)
}

// AlertGroupRuleTestNotificationByID sends a test notification for an alert group rule by ID.
func (s *Service) AlertGroupRuleTestNotificationByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")

	var req alertGroupTestNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if req.Title == "" {
		invalidData(w, fmt.Errorf("title is required"), s.Logger)
		return
	}
	if req.Message == "" {
		invalidData(w, fmt.Errorf("message is required"), s.Logger)
		return
	}

	rule, err := s.AlertGroupRules.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	userGroups, err := s.AlertGroupRules.UserGroupsByRule(ctx, id)
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}
	kapacitorID := req.KapacitorID
	if kapacitorID == "" {
		kapacitorID = rule.KapacitorID
	}
	if kapacitorID == "" {
		invalidData(w, fmt.Errorf("rule has no kapacitor configured"), s.Logger)
		return
	}
	resp, err := s.sendAlertGroupTestNotification(ctx, rule.OrgID, kapacitorID, userGroups, req.Title, req.Message, req.Recipients)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, resp, s.Logger)
}

// AlertGroupRuleDelete deletes an alert group rule.
func (s *Service) AlertGroupRuleDelete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	rule, err := s.AlertGroupRules.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	if rule.KapacitorID != "" {
		if kapa, err := s.AlertKapacitors.Get(ctx, rule.KapacitorID); err == nil {
			if err := deleteKapacitorTask(kapa.URL, "alert-group-"+id); err != nil {
				s.Logger.Error("AlertGroupRuleDelete: delete kapacitor task:", err)
			}
		}
	}
	if err := s.AlertGroupRules.Delete(ctx, id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AlertGroupRuleSetHosts sets the hosts for an alert group rule.
func (s *Service) AlertGroupRuleSetHosts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	var req struct {
		Hostnames []string `json:"hostnames"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetHosts(ctx, id, req.Hostnames); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AlertGroupRuleSetUserGroups sets the user groups for an alert group rule.
func (s *Service) AlertGroupRuleSetUserGroups(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	var req struct {
		UserGroupIDs []string `json:"userGroupIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetUserGroups(ctx, id, req.UserGroupIDs); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SyncKapacitorTask aligns Kapacitor with the rule. Recipients are passed pre-resolved
// so the tickscript embeds the current static email list.
func (s *Service) syncKapacitorTask(ctx context.Context, rule cloudhub.AlertGroupRule, recipients kapackage.AlertRecipients) error {
	if rule.KapacitorID == "" {
		return nil
	}
	kapa, err := s.AlertKapacitors.Get(ctx, rule.KapacitorID)
	if err != nil {
		return fmt.Errorf("syncKapacitorTask: get kapacitor: %w", err)
	}
	taskID := "alert-group-" + rule.ID
	var hostnames []string
	if s.AlertGroupRules != nil {
		hostnames, err = s.AlertGroupRules.Hostnames(ctx, rule.ID)
		if err != nil {
			return fmt.Errorf("syncKapacitorTask: resolve hostnames: %w", err)
		}
	}
	s.Logger.Info(fmt.Sprintf(
		"alert-group sync start task=%s rule=%s kapacitor=%s active=%t db=%s rp=%s recipients=%d/%d/%d hosts=%d",
		taskID, rule.ID, rule.KapacitorID, rule.Active, rule.Database, rule.RetentionPolicy,
		len(recipients.Info), len(recipients.Warn), len(recipients.Crit), len(hostnames),
	))

	tick, err := kapackage.AlertGroupRuleTICKScript(rule, recipients, hostnames)
	if err != nil {
		return fmt.Errorf("syncKapacitorTask: generate tickscript: %w", err)
	}

	if !rule.Active {
		missing, err := patchKapacitorTask(kapa.URL, taskID, tick, rule.Database, rule.RetentionPolicy, "disabled")
		if err != nil {
			s.Logger.Error(fmt.Sprintf("alert-group sync disable failed task=%s error=%v", taskID, err))
			return err
		}
		if missing {
			s.Logger.Info(fmt.Sprintf("alert-group sync inactive no kapacitor task task=%s", taskID))
		} else {
			s.Logger.Info(fmt.Sprintf("alert-group sync disabled task=%s", taskID))
		}
		return nil
	}

	missing, err := patchKapacitorTask(kapa.URL, taskID, tick, rule.Database, rule.RetentionPolicy, "enabled")
	if err != nil {
		s.Logger.Error(fmt.Sprintf("alert-group sync patch failed task=%s error=%v", taskID, err))
		return err
	}
	if missing {
		if err := createKapacitorTask(kapa.URL, taskID, tick, rule.Database, rule.RetentionPolicy); err != nil {
			s.Logger.Error(fmt.Sprintf("alert-group sync create failed task=%s error=%v", taskID, err))
			return err
		}
		s.Logger.Info(fmt.Sprintf("alert-group sync created task=%s", taskID))
		return nil
	}
	s.Logger.Info(fmt.Sprintf("alert-group sync enabled task=%s", taskID))
	return nil
}

var errAlertKapacitorStoreUnavailable = errors.New("alert kapacitor store unavailable")

func (s *Service) validateAlertGroupKapacitor(ctx context.Context, orgID, kapacitorID string) error {
	if kapacitorID == "" {
		return nil
	}
	if _, err := uuid.Parse(kapacitorID); err != nil {
		return fmt.Errorf("kapacitorId must be a valid UUID")
	}
	if s.AlertKapacitors == nil {
		return errAlertKapacitorStoreUnavailable
	}
	kapa, err := s.AlertKapacitors.Get(ctx, kapacitorID)
	if err != nil {
		return fmt.Errorf("kapacitorId not found")
	}
	if orgID != "" && kapa.OrgID != "" && kapa.OrgID != orgID {
		return fmt.Errorf("kapacitorId does not belong to the current organization")
	}
	return nil
}

func validateAlertGroupRuleInput(rule cloudhub.AlertGroupRule) error {
	trigger := strings.TrimSpace(strings.ToLower(rule.Trigger))
	if trigger == "" {
		trigger = cloudhub.AlertGroupRuleTriggerThreshold
	}
	if trigger == cloudhub.AlertGroupRuleTriggerDeadman {
		tt := strings.TrimSpace(strings.ToLower(rule.TaskType))
		if tt == "" {
			tt = cloudhub.AlertGroupRuleTaskTypeStream
		}
		if tt != cloudhub.AlertGroupRuleTaskTypeStream {
			return fmt.Errorf("deadman alert rules require task type stream")
		}
	}

	for _, condition := range rule.Conditions {
		if !condition.Enabled {
			continue
		}
		if strings.TrimSpace(condition.Value) == "" {
			return fmt.Errorf("%s condition value is required when enabled", condition.Level)
		}
	}
	return nil
}

// resolveRuleRecipients merges direct-input + user_group recipients into
// level buckets for tickscript embedding.
func (s *Service) resolveRuleRecipients(ctx context.Context, rule cloudhub.AlertGroupRule) (kapackage.AlertRecipients, error) {
	var groups []cloudhub.UserGroup
	if len(rule.UserGroupIDs) > 0 && s.AlertGroupRules != nil && rule.ID != "" {
		ug, err := s.AlertGroupRules.UserGroupsByRule(ctx, rule.ID)
		if err != nil {
			return kapackage.AlertRecipients{}, err
		}
		groups = ug
	}
	return kapackage.ResolveAlertRecipients(rule, groups), nil
}

func (s *Service) resolveDraftAlertGroupUserGroups(ctx context.Context, orgID string, userGroupIDs []string) ([]cloudhub.UserGroup, error) {
	if s.UserGroups == nil {
		return nil, fmt.Errorf("user group store unavailable")
	}
	if len(userGroupIDs) == 0 {
		// Empty selection means "no group recipients"; merging with manual
		// recipients or the logged-in-user fallback happens upstream.
		return nil, nil
	}

	seen := map[string]bool{}
	var out []cloudhub.UserGroup
	for _, gid := range userGroupIDs {
		group, err := s.UserGroups.Get(ctx, gid)
		if err != nil {
			return nil, err
		}
		if group.OrgID != "" && orgID != "" && group.OrgID != orgID {
			continue
		}
		if !seen[group.ID] {
			seen[group.ID] = true
			out = append(out, group)
		}
	}
	return out, nil
}

func (s *Service) sendAlertGroupTestNotification(ctx context.Context, orgID, kapacitorID string, userGroups []cloudhub.UserGroup, title, message string, manualRecipients []string) (alertGroupTestNotificationResponse, error) {
	// recipients = manualRecipients ∪ userGroup members ∪ {logged-in user as fallback}
	combined := append([]string{}, manualRecipients...)
	if len(userGroups) > 0 {
		combined = append(combined, collectAlertGroupTestRecipientsRaw(userGroups)...)
	}
	recipients := normalizeAlertGroupTestRecipients(combined)
	if len(recipients) == 0 {
		if user, ok := hasUserContext(ctx); ok && user.Email != "" {
			recipients = []string{user.Email}
		}
	}
	if len(recipients) == 0 {
		return alertGroupTestNotificationResponse{}, fmt.Errorf("recipient not found")
	}

	if s.AlertKapacitors == nil {
		return alertGroupTestNotificationResponse{}, fmt.Errorf("alert kapacitor store unavailable")
	}
	kapa, err := s.AlertKapacitors.Get(ctx, kapacitorID)
	if err != nil {
		return alertGroupTestNotificationResponse{}, fmt.Errorf("kapacitor not found: %s", kapacitorID)
	}
	recipientsLog := strings.Join(recipients, ",")
	s.Logger.Info(fmt.Sprintf(
		"alert-group test send start org_id=%s kapacitor_url=%s recipients=%s title=%s",
		orgID, kapa.URL, recipientsLog, title,
	))
	if err := kapacitorSMTPSender(ctx, kapa.URL, recipients, title, message); err != nil {
		s.Logger.Error(fmt.Sprintf(
			"alert-group test send failed org_id=%s kapacitor_url=%s recipients=%s error=%v",
			orgID, kapa.URL, recipientsLog, err,
		))
		return alertGroupTestNotificationResponse{}, err
	}
	s.Logger.Info(fmt.Sprintf(
		"alert-group test send succeeded org_id=%s kapacitor_url=%s recipients=%s sent_count=%d",
		orgID, kapa.URL, recipientsLog, len(recipients),
	))

	return alertGroupTestNotificationResponse{
		ResolvedUserGroups: len(userGroups),
		ResolvedRecipients: recipients,
		SentCount:          len(recipients),
	}, nil
}

func collectAlertGroupTestRecipientsRaw(userGroups []cloudhub.UserGroup) []string {
	seen := map[string]bool{}
	var recipients []string
	for _, group := range userGroups {
		for _, member := range group.Members {
			if !member.EmailEnabled || member.Email == "" || seen[member.Email] {
				continue
			}
			seen[member.Email] = true
			recipients = append(recipients, member.Email)
		}
		for _, node := range group.AlertNodes.Email {
			for _, to := range node.To {
				if to == "" || seen[to] {
					continue
				}
				seen[to] = true
				recipients = append(recipients, to)
			}
		}
	}
	return recipients
}

func normalizeAlertGroupTestRecipients(recipients []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(recipients))
	for _, recipient := range recipients {
		if recipient == "" || seen[recipient] {
			continue
		}
		seen[recipient] = true
		out = append(out, recipient)
	}
	return out
}

func kapacitorEndpointURL(kapaURL, endpoint string) string {
	return strings.TrimRight(kapaURL, "/") + endpoint
}

// sendViaKapacitorSMTPServiceTest invokes Kapacitor's built-in SMTP service-test
// endpoint to send a test email using whatever SMTP config Kapacitor is wired
// up with. This is the same configuration used by the .email() handler that
// the generated TICKscript embeds, so test sends and real alert sends share
// the same delivery path.
func sendViaKapacitorSMTPServiceTest(ctx context.Context, kapaURL string, to []string, subject, body string) error {
	payload := map[string]interface{}{
		"to":      to,
		"subject": subject,
		"body":    body,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal smtp request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		kapacitorEndpointURL(kapaURL, "/kapacitor/v1/service-tests/smtp"),
		bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("build smtp request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("kapacitor smtp request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("kapacitor smtp returned %d: %s", resp.StatusCode, b)
	}
	var result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode smtp response: %w", err)
	}
	if !result.Success {
		msg := result.Message
		if msg == "" {
			msg = "kapacitor reported failure"
		}
		return fmt.Errorf("kapacitor smtp failed: %s", msg)
	}
	return nil
}

// deleteKapacitorTask sends DELETE /kapacitor/v1/tasks/{id} to the given Kapacitor.
func deleteKapacitorTask(kapaURL, taskID string) error {
	req, err := http.NewRequest(http.MethodDelete, kapacitorEndpointURL(kapaURL, "/kapacitor/v1/tasks/"+taskID), nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// patchKapacitorTask updates script + status on an existing Kapacitor stream task.
// missing is true when Kapacitor returned 404 (no task to update).
func patchKapacitorTask(kapaURL, taskID, tick, database, retentionPolicy, status string) (missing bool, err error) {
	body := map[string]interface{}{
		"id":     taskID,
		"type":   "stream",
		"dbrps":  []map[string]string{{"db": database, "rp": retentionPolicy}},
		"script": tick,
		"status": status,
	}
	data, err := json.Marshal(body)
	if err != nil {
		return false, err
	}
	req, err := http.NewRequest(http.MethodPatch, kapacitorEndpointURL(kapaURL, "/kapacitor/v1/tasks/"+taskID), bytes.NewReader(data))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return true, nil
	}
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("kapacitor patch task %d: %s", resp.StatusCode, b)
	}
	return false, nil
}

// createKapacitorTask registers a new enabled stream task on Kapacitor.
func createKapacitorTask(kapaURL, taskID, tick, database, retentionPolicy string) error {
	body := map[string]interface{}{
		"id":     taskID,
		"type":   "stream",
		"dbrps":  []map[string]string{{"db": database, "rp": retentionPolicy}},
		"script": tick,
		"status": "enabled",
	}
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	resp, err := http.Post(kapacitorEndpointURL(kapaURL, "/kapacitor/v1/tasks"), "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("kapacitor create task %d: %s", resp.StatusCode, b)
	}
	return nil
}
