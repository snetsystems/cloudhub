// Package server provides the HTTP server for the CloudHub API.
package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"strconv"
	"strings"

	"github.com/bouk/httprouter"
	"github.com/google/uuid"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	kapackage "github.com/snetsystems/cloudhub/backend/kapacitor"
)

type alertGroupTestNotificationRequest struct {
	KapacitorID       string   `json:"kapacitorId,omitempty"`
	RecipientGroupIDs []string `json:"recipientGroupIds,omitempty"`
	Recipients        []string `json:"recipients,omitempty"`
	IncludeSelf       bool     `json:"includeSelf,omitempty"`
	Title             string   `json:"title"`
	Message           string   `json:"message"`
}

type alertGroupTestNotificationResponse struct {
	ResolvedRecipientGroups int      `json:"resolvedRecipientGroups"`
	ResolvedRecipients      []string `json:"resolvedRecipients"`
	SentCount               int      `json:"sentCount"`
}

// kapacitorSMTPSender is overridable in tests to bypass real HTTP calls.
var kapacitorSMTPSender = sendViaKapacitorSMTPServiceTest

// AlertGroupRulesGet gets all alert group rules.
func (s *Service) AlertGroupRulesGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID, _ := hasOrganizationContext(ctx)
	rules, err := s.AlertGroupRules.All(ctx, orgID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	targetTypeFilter := r.URL.Query().Get("targetType")
	var filteredRules []cloudhub.AlertGroupRule

	for i := range rules {
		if targetTypeFilter != "" && rules[i].TargetType != targetTypeFilter {
			continue
		}
		denormalizeAlertGroupRuleConditionOperators(&rules[i])
		recipients, err := s.resolveRuleRecipients(ctx, rules[i])
		if err != nil {
			s.Logger.Error("AlertGroupRulesGet: resolve recipients:", err)
			continue
		}
		processor := s.getTargetProcessor(ctx, rules[i])
		var targets []string
		if processor.Type() == "url" {
			targets = rules[i].URLTargetIDs
		} else {
			targets, _ = s.AlertGroupRules.Hostnames(ctx, rules[i].ID)
		}
		filter := processor.BuildTickscriptFilter(targets)
		rules[i].Tickscript, _ = kapackage.AlertGroupRuleTICKScript(rules[i], recipients, filter)
		filteredRules = append(filteredRules, rules[i])
	}
	if filteredRules == nil {
		filteredRules = []cloudhub.AlertGroupRule{}
	}
	encodeJSON(w, http.StatusOK, map[string]interface{}{"alertGroupRules": filteredRules}, s.Logger)
}

// AlertGroupRuleCreate creates a new alert group rule.
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
	req.KapacitorID = s.normalizeAlertGroupKapacitorID(ctx, req.KapacitorID)
	if err := s.validateAlertGroupKapacitor(ctx, req.OrgID, req.KapacitorID); err != nil {
		if errors.Is(err, errAlertKapacitorStoreUnavailable) {
			internalServerError(w, err, s.Logger)
			return
		}
		invalidData(w, err, s.Logger)
		return
	}
	if err := validateAlertGroupRuleInput(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	normalizeAlertGroupRuleConditionOperators(&req)
	rule, err := s.AlertGroupRules.Add(ctx, req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	// Persist host/event-handler/condition associations alongside the rule itself.
	if err := s.AlertGroupRules.SetHosts(ctx, rule.ID, req.Hostnames); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetURLTargets(ctx, rule.ID, req.URLTargetIDs); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetEventHandlers(ctx, rule.ID, req.EventHandlers); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	
	rule.Hostnames = req.Hostnames
	if handlers, err := s.AlertGroupRules.EventHandlersByRule(ctx, rule.ID); err == nil {
		rule.EventHandlers = handlers
	} else {
		rule.EventHandlers = req.EventHandlers
	}
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
	processor := s.getTargetProcessor(ctx, rule)
	var targets []string
	if processor.Type() == "url" {
		targets = rule.URLTargetIDs
	} else {
		targets = rule.Hostnames
	}
	filter := processor.BuildTickscriptFilter(targets)
	rule.Tickscript, _ = kapackage.AlertGroupRuleTICKScript(rule, recipients, filter)
	encodeJSON(w, http.StatusCreated, rule, s.Logger)
}

// AlertGroupRuleIDGet gets an alert group rule by ID.
func (s *Service) AlertGroupRuleIDGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	rule, err := s.AlertGroupRules.Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	denormalizeAlertGroupRuleConditionOperators(&rule)
	recipients, err := s.resolveRuleRecipients(ctx, rule)
	if err != nil {
		s.Logger.Error("AlertGroupRuleIDGet: resolve recipients:", err)
	}
	processor := s.getTargetProcessor(ctx, rule)
	var targets []string
	if processor.Type() == "url" {
		targets = rule.URLTargetIDs
	} else {
		targets = rule.Hostnames
	}
	filter := processor.BuildTickscriptFilter(targets)
	rule.Tickscript, _ = kapackage.AlertGroupRuleTICKScript(rule, recipients, filter)
	encodeJSON(w, http.StatusOK, rule, s.Logger)
}

// AlertGroupRuleUpdate updates an alert group rule.
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
	req.KapacitorID = s.normalizeAlertGroupKapacitorID(ctx, req.KapacitorID)
	if err := s.validateAlertGroupKapacitor(ctx, existing.OrgID, req.KapacitorID); err != nil {
		if errors.Is(err, errAlertKapacitorStoreUnavailable) {
			internalServerError(w, err, s.Logger)
			return
		}
		invalidData(w, err, s.Logger)
		return
	}
	if err := validateAlertGroupRuleInput(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	normalizeAlertGroupRuleConditionOperators(&req)
	if err := s.AlertGroupRules.Update(ctx, req); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetHosts(ctx, id, req.Hostnames); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetURLTargets(ctx, id, req.URLTargetIDs); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetEventHandlers(ctx, id, req.EventHandlers); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	
	if handlers, err := s.AlertGroupRules.EventHandlersByRule(ctx, id); err == nil {
		req.EventHandlers = handlers
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
	processor := s.getTargetProcessor(ctx, req)
	var targets []string
	if processor.Type() == "url" {
		targets = req.URLTargetIDs
	} else {
		targets, _ = s.AlertGroupRules.Hostnames(ctx, req.ID)
	}
	filter := processor.BuildTickscriptFilter(targets)
	req.Tickscript, _ = kapackage.AlertGroupRuleTICKScript(req, recipients, filter)
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
	req.KapacitorID = s.normalizeAlertGroupKapacitorID(ctx, req.KapacitorID)
	recipientGroups, err := s.resolveDraftAlertGroupRecipientGroups(ctx, orgID, req.RecipientGroupIDs)
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}
	resp, err := s.sendAlertGroupTestNotification(ctx, orgID, req.KapacitorID, recipientGroups, req.Recipients, req.IncludeSelf, req.Title, req.Message)
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
	var recipientGroups []cloudhub.RecipientGroup
	if req.RecipientGroupIDs != nil {
		recipientGroups, err = s.resolveDraftAlertGroupRecipientGroups(ctx, rule.OrgID, req.RecipientGroupIDs)
	} else {
		recipientGroups, err = s.resolveRuleEmailRecipientGroups(ctx, rule)
	}
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
	kapacitorID = s.normalizeAlertGroupKapacitorID(ctx, kapacitorID)
	resp, err := s.sendAlertGroupTestNotification(ctx, rule.OrgID, kapacitorID, recipientGroups, req.Recipients, req.IncludeSelf, req.Title, req.Message)
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

// AlertGroupRuleSetURLTargets sets the URL targets for an alert group rule.
func (s *Service) AlertGroupRuleSetURLTargets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	var req struct {
		URLTargetIDs []string `json:"urlTargetIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetURLTargets(ctx, id, req.URLTargetIDs); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AlertGroupRuleSetEventHandlers sets event handlers for an alert group rule.
func (s *Service) AlertGroupRuleSetEventHandlers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParam(r, "id")
	var req struct {
		EventHandlers []cloudhub.AlertRuleEventHandler `json:"eventHandlers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if err := validateAlertRuleEventHandlers(req.EventHandlers); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	if err := s.AlertGroupRules.SetEventHandlers(ctx, id, req.EventHandlers); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	rule, err := s.AlertGroupRules.Get(ctx, id)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.regenRule(ctx, rule); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SyncKapacitorTask aligns Kapacitor with the rule. Recipients are passed pre-resolved
// so the tickscript embeds the current static email list.
func (s *Service) syncKapacitorTask(ctx context.Context, rule cloudhub.AlertGroupRule, recipients kapackage.AlertRecipients) error {
	db := "cloudhub"
	rp := "autogen"
	if len(rule.Specs) > 0 && rule.Specs[0].Database != "" {
		db = rule.Specs[0].Database
		rp = rule.Specs[0].RetentionPolicy
	}

	if rule.KapacitorID == "" {
		return nil
	}
	kapa, err := s.AlertKapacitors.Get(ctx, rule.KapacitorID)
	if err != nil {
		return fmt.Errorf("syncKapacitorTask: get kapacitor: %w", err)
	}
	taskID := "alert-group-" + rule.ID
	processor := s.getTargetProcessor(ctx, rule)
	var targets []string
	if processor.Type() == "url" {
		targets, err = s.AlertGroupRules.URLTargetIDs(ctx, rule.ID)
	} else {
		targets, err = s.AlertGroupRules.Hostnames(ctx, rule.ID)
	}
	if err != nil {
		return fmt.Errorf("syncKapacitorTask: resolve targets: %w", err)
	}
	
	s.Logger.Info(fmt.Sprintf(
		"alert-group sync start task=%s rule=%s kapacitor=%s active=%t db=%s rp=%s recipients=%d/%d/%d targets=%d",
		taskID, rule.ID, rule.KapacitorID, rule.Active, db, rp,
		len(recipients.Info), len(recipients.Warn), len(recipients.Crit), len(targets),
	))

	filter := processor.BuildTickscriptFilter(targets)
	tick, err := kapackage.AlertGroupRuleTICKScript(rule, recipients, filter)
	if err != nil {
		return fmt.Errorf("syncKapacitorTask: generate tickscript: %w", err)
	}

	if !rule.Active {
		missing, err := patchKapacitorTask(kapa.URL, taskID, tick, db, rp, "disabled")
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

	// Kapacitor 1.5+ may update the script text on a PATCH but fail to rebuild the running DAG
	// if the task is already enabled. We explicitly disable it first to force a clean reload.
	_, _ = patchKapacitorTask(kapa.URL, taskID, tick, db, rp, "disabled")

	missing, err := patchKapacitorTask(kapa.URL, taskID, tick, db, rp, "enabled")
	if err != nil {
		s.Logger.Error(fmt.Sprintf("alert-group sync patch failed task=%s error=%v", taskID, err))
		return err
	}
	if missing {
		if err := createKapacitorTask(kapa.URL, taskID, tick, db, rp); err != nil {
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

// normalizeAlertGroupKapacitorID converts a legacy numeric kapacitor ID
// (sources sub-resource) into the matching alert_kapacitors UUID. Returns the
// input untouched when empty, already a UUID, or when no mapping is found —
// downstream validation will then surface the error.
// If the legacy kapacitor exists but no mapping has been backfilled yet
// (the user never visited GET /v2/alert-kapacitors), this triggers an
// idempotent sync so the rule create flow doesn't fail with 422.
func (s *Service) normalizeAlertGroupKapacitorID(ctx context.Context, kapacitorID string) string {
	if kapacitorID == "" {
		return kapacitorID
	}
	if _, err := uuid.Parse(kapacitorID); err == nil {
		return kapacitorID
	}
	legacyID, err := strconv.Atoi(kapacitorID)
	if err != nil {
		return kapacitorID
	}
	if s.Store == nil || s.AlertKapacitorMappings == nil {
		return kapacitorID
	}
	srv, err := s.Store.Servers(ctx).Get(ctx, legacyID)
	if err != nil {
		return kapacitorID
	}
	uuidID, err := s.AlertKapacitorMappings.GetAlertKapacitorID(ctx, srv.SrcID, srv.ID)
	if err == nil {
		return uuidID
	}
	// Mapping missing — backfill from the legacy kapacitor and retry once.
	if syncErr := s.syncAlertKapacitorFromLegacy(ctx, srv); syncErr != nil {
		s.Logger.Error(fmt.Sprintf("normalizeAlertGroupKapacitorID: sync legacy kapacitor %d failed: %v", legacyID, syncErr))
		return kapacitorID
	}
	uuidID, err = s.AlertKapacitorMappings.GetAlertKapacitorID(ctx, srv.SrcID, srv.ID)
	if err != nil {
		return kapacitorID
	}
	return uuidID
}

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

func validateAlertGroupRuleInput(rule *cloudhub.AlertGroupRule) error {
	target := strings.TrimSpace(strings.ToLower(rule.TargetType))
	if target == "" {
		rule.TargetType = "host"
	} else if target != "host" && target != "url" {
		return fmt.Errorf("invalid targetType: %s", target)
	} else {
		rule.TargetType = target
	}


	for _, spec := range rule.Specs {
		if strings.TrimSpace(spec.Database) == "" {
			return fmt.Errorf("database is required in spec")
		}
		if strings.TrimSpace(spec.RetentionPolicy) == "" {
			return fmt.Errorf("retentionPolicy is required in spec")
		}
		if strings.TrimSpace(spec.Measurement) == "" {
			return fmt.Errorf("measurement is required in spec")
		}
		if strings.TrimSpace(spec.Field) == "" {
			return fmt.Errorf("field is required in spec")
		}

		trigger := strings.TrimSpace(strings.ToLower(spec.Trigger))
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
			if spec.TriggerValues == nil || strings.TrimSpace(spec.TriggerValues.Period) == "" {
				return fmt.Errorf("deadman alert rules require a period in values")
			}
		}
		if trigger == cloudhub.AlertGroupRuleTriggerRelative {
			if spec.TriggerValues == nil || strings.TrimSpace(spec.TriggerValues.Shift) == "" {
				return fmt.Errorf("relative alert rules require a shift in values")
			}
			if strings.TrimSpace(spec.TriggerValues.Change) == "" {
				return fmt.Errorf("relative alert rules require a change type in values")
			}
		}
	}
	if err := validateAlertRuleEventHandlers(rule.EventHandlers); err != nil {
		return err
	}
	return nil
}

func normalizeAlertGroupRuleConditionOperators(rule *cloudhub.AlertGroupRule) {
	for i := range rule.Specs {
		var expanded []cloudhub.AlertRuleCondition
		for _, c := range rule.Specs[i].Conditions {
			c.Operator = cloudhub.NormalizeAlertConditionOperator(c.Operator)
			expanded = append(expanded, c)
		}
		if rule.Specs[i].UrlErrorConfig != nil {
			if rule.Specs[i].UrlErrorConfig.Check4xx {
				expanded = append(expanded, cloudhub.AlertRuleCondition{
					Level:    "url_4xx",
					Operator: "greater_equal",
					Value:    400,
					Enabled:  true,
				})
			}
			if rule.Specs[i].UrlErrorConfig.Check5xx {
				expanded = append(expanded, cloudhub.AlertRuleCondition{
					Level:    "url_5xx",
					Operator: "greater_equal",
					Value:    500,
					Enabled:  true,
				})
			}
			if rule.Specs[i].UrlErrorConfig.Unknown {
				expanded = append(expanded, cloudhub.AlertRuleCondition{
					Level:    "url_unknown",
					Operator: "equal",
					Value:    0,
					Enabled:  true,
				})
			}
			rule.Specs[i].UrlErrorConfig = nil
		}
		rule.Specs[i].Conditions = expanded
	}
}

func denormalizeAlertGroupRuleConditionOperators(rule *cloudhub.AlertGroupRule) {
	for i := range rule.Specs {
		var filtered []cloudhub.AlertRuleCondition
		var urlConfig cloudhub.UrlErrorConfig
		hasUrlConfig := false

		for _, c := range rule.Specs[i].Conditions {
			switch c.Level {
			case "url_4xx":
				urlConfig.Check4xx = true
				hasUrlConfig = true
			case "url_5xx":
				urlConfig.Check5xx = true
				hasUrlConfig = true
			case "url_unknown":
				urlConfig.Unknown = true
				hasUrlConfig = true
			default:
				filtered = append(filtered, c)
			}
		}
		if hasUrlConfig {
			rule.Specs[i].UrlErrorConfig = &urlConfig
		}
		rule.Specs[i].Conditions = filtered
	}
}

func validateAlertRuleEventHandlers(handlers []cloudhub.AlertRuleEventHandler) error {
	for _, h := range handlers {
		if !h.Enabled {
			continue
		}
		cfg := h.ConfigJSON
		if len(cfg) == 0 {
			cfg = []byte(`{}`)
		}
		switch strings.ToLower(strings.TrimSpace(h.Type)) {
		case "", cloudhub.AlertRuleEventHandlerEmail, cloudhub.AlertRuleEventHandlerSMS:
			continue
		case cloudhub.AlertRuleEventHandlerWebhook:
			var v cloudhub.Post
			if err := json.Unmarshal(cfg, &v); err != nil {
				return fmt.Errorf("webhook configJson is invalid")
			}
			if strings.TrimSpace(v.URL) == "" {
				return fmt.Errorf("webhook url is required")
			}
		case cloudhub.AlertRuleEventHandlerTCP:
			var v cloudhub.TCP
			if err := json.Unmarshal(cfg, &v); err != nil {
				return fmt.Errorf("tcp configJson is invalid")
			}
			if strings.TrimSpace(v.Address) == "" {
				return fmt.Errorf("tcp address is required")
			}
		case cloudhub.AlertRuleEventHandlerExec:
			var v cloudhub.Exec
			if err := json.Unmarshal(cfg, &v); err != nil {
				return fmt.Errorf("exec configJson is invalid")
			}
			if len(v.Command) == 0 {
				return fmt.Errorf("exec command is required")
			}
		case cloudhub.AlertRuleEventHandlerLog:
			var v cloudhub.Log
			if err := json.Unmarshal(cfg, &v); err != nil {
				return fmt.Errorf("log configJson is invalid")
			}
			if strings.TrimSpace(v.FilePath) == "" {
				return fmt.Errorf("log filePath is required")
			}
		case cloudhub.AlertRuleEventHandlerKafka:
			var v cloudhub.Kafka
			if err := json.Unmarshal(cfg, &v); err != nil {
				return fmt.Errorf("kafka configJson is invalid")
			}
			if strings.TrimSpace(v.Cluster) == "" {
				return fmt.Errorf("kafka cluster is required")
			}
			if strings.TrimSpace(v.Topic) == "" {
				return fmt.Errorf("kafka kafka-topic is required")
			}
		case cloudhub.AlertRuleEventHandlerSlack:
			var v cloudhub.Slack
			if err := json.Unmarshal(cfg, &v); err != nil {
				return fmt.Errorf("slack configJson is invalid")
			}
			if strings.TrimSpace(v.Workspace) == "" {
				return fmt.Errorf("slack workspace is required")
			}
			if strings.TrimSpace(v.Channel) == "" {
				return fmt.Errorf("slack channel is required")
			}
		case cloudhub.AlertRuleEventHandlerTelegram:
			var v cloudhub.Telegram
			if err := json.Unmarshal(cfg, &v); err != nil {
				return fmt.Errorf("telegram configJson is invalid")
			}
			if strings.TrimSpace(v.ChatID) == "" {
				return fmt.Errorf("telegram chatId is required")
			}
		default:
			return fmt.Errorf("unsupported event handler type %q", h.Type)
		}
	}
	return nil
}

// resolveRuleRecipients resolves the enabled email handler's recipient groups,
// then buckets emails by alert level (info/warn/crit). Missing/disabled email
// handler means no external email notification; the rule can still emit alert
// events to the output measurement.
func (s *Service) resolveRuleRecipients(ctx context.Context, rule cloudhub.AlertGroupRule) (kapackage.AlertRecipients, error) {
	if rule.ID == "" || s.AlertGroupRules == nil {
		return kapackage.AlertRecipients{}, nil
	}
	groups, err := s.resolveRuleEmailRecipientGroups(ctx, rule)
	if err != nil {
		return kapackage.AlertRecipients{}, err
	}
	return s.buildAlertRecipientsFromGroups(ctx, groups), nil
}

func (s *Service) resolveRuleEmailRecipientGroups(ctx context.Context, rule cloudhub.AlertGroupRule) ([]cloudhub.RecipientGroup, error) {
	handlers := rule.EventHandlers
	if len(handlers) == 0 && rule.ID != "" && s.AlertGroupRules != nil {
		var err error
		handlers, err = s.AlertGroupRules.EventHandlersByRule(ctx, rule.ID)
		if err != nil {
			return nil, err
		}
	}
	for _, h := range handlers {
		if strings.EqualFold(strings.TrimSpace(h.Type), cloudhub.AlertRuleEventHandlerEmail) && h.Enabled {
			if len(h.RecipientGroupIDs) == 0 {
				return s.allOrgRecipientGroups(ctx, rule.OrgID)
			}
			if h.ID != "" && s.AlertGroupRules != nil {
				return s.AlertGroupRules.RecipientGroupsByEventHandler(ctx, h.ID)
			}
			return s.recipientGroupsByIDs(ctx, rule.OrgID, h.RecipientGroupIDs)
		}
	}
	return nil, nil
}

func (s *Service) recipientGroupsByIDs(ctx context.Context, orgID string, recipientGroupIDs []string) ([]cloudhub.RecipientGroup, error) {
	if s.RecipientGroups == nil {
		return nil, fmt.Errorf("recipient group store unavailable")
	}
	seen := map[string]bool{}
	var out []cloudhub.RecipientGroup
	for _, gid := range recipientGroupIDs {
		group, err := s.RecipientGroups.Get(ctx, gid)
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

func (s *Service) allOrgRecipientGroups(ctx context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
	if s.RecipientGroups == nil {
		return nil, fmt.Errorf("recipient group store unavailable")
	}
	orgID = strings.TrimSpace(orgID)
	if orgID == "" {
		return nil, nil
	}
	return s.RecipientGroups.All(ctx, orgID)
}

// buildAlertRecipientsFromGroups builds level-bucketed lists from already-resolved
// recipient groups, fetching per-member alert prefs to filter by EmailEnabled/EmailLevel.
func (s *Service) buildAlertRecipientsFromGroups(ctx context.Context, groups []cloudhub.RecipientGroup) kapackage.AlertRecipients {
	var info, warn, crit recipientBucket
	for _, g := range groups {
		for _, m := range g.Members {
			addr := strings.TrimSpace(m.Email)
			if addr == "" {
				continue
			}
			if s.AlertRecipientMemberPrefs == nil {
				continue
			}
			prefs, err := s.AlertRecipientMemberPrefs.Get(ctx, m.ID)
			if err != nil || !prefs.EmailEnabled {
				continue
			}
			switch strings.ToLower(strings.TrimSpace(prefs.EmailLevel)) {
			case "all", "":
				info.add(addr)
				warn.add(addr)
				crit.add(addr)
			case "warning":
				warn.add(addr)
				crit.add(addr)
			case "critical":
				crit.add(addr)
			}
		}
	}
	return kapackage.AlertRecipients{Info: info.list, Warn: warn.list, Crit: crit.list}
}

// recipientBucket is a small case-insensitive dedup'd list builder local to
// alert_rules.go (was previously a helper inside kapacitor.ResolveAlertRecipients).
type recipientBucket struct {
	seen map[string]bool
	list []string
}

func (b *recipientBucket) add(addr string) {
	if b.seen == nil {
		b.seen = map[string]bool{}
	}
	key := strings.ToLower(addr)
	if b.seen[key] {
		return
	}
	b.seen[key] = true
	b.list = append(b.list, addr)
}

func (s *Service) resolveDraftAlertGroupRecipientGroups(ctx context.Context, orgID string, recipientGroupIDs []string) ([]cloudhub.RecipientGroup, error) {
	if s.RecipientGroups == nil {
		return nil, fmt.Errorf("recipient group store unavailable")
	}
	if len(recipientGroupIDs) == 0 {
		return nil, nil
	}

	return s.recipientGroupsByIDs(ctx, orgID, recipientGroupIDs)
}

func (s *Service) sendAlertGroupTestNotification(ctx context.Context, orgID, kapacitorID string, recipientGroups []cloudhub.RecipientGroup, directRecipients []string, includeSelf bool, title, message string) (alertGroupTestNotificationResponse, error) {
	// recipients = explicitly selected recipient-group members ∪ direct recipients ∪ optional logged-in user.
	// .Info is the superset of warning/critical because "all"/"" levels populate all three buckets.
	resolved := s.buildAlertRecipientsFromGroups(ctx, recipientGroups)
	var recipients recipientBucket
	for _, addr := range resolved.Info {
		recipients.add(addr)
	}
	if err := addDirectAlertGroupTestRecipients(&recipients, directRecipients); err != nil {
		return alertGroupTestNotificationResponse{}, err
	}
	if includeSelf {
		if user, ok := hasUserContext(ctx); ok && user.Email != "" {
			if err := addDirectAlertGroupTestRecipients(&recipients, []string{user.Email}); err != nil {
				return alertGroupTestNotificationResponse{}, err
			}
		}
	}
	if len(recipients.list) == 0 {
		return alertGroupTestNotificationResponse{}, fmt.Errorf("recipient not found")
	}

	if s.AlertKapacitors == nil {
		return alertGroupTestNotificationResponse{}, fmt.Errorf("alert kapacitor store unavailable")
	}
	kapa, err := s.AlertKapacitors.Get(ctx, kapacitorID)
	if err != nil {
		return alertGroupTestNotificationResponse{}, fmt.Errorf("kapacitor not found: %s", kapacitorID)
	}
	recipientsLog := strings.Join(recipients.list, ",")
	s.Logger.Info(fmt.Sprintf(
		"alert-group test send start org_id=%s kapacitor_url=%s recipients=%s title=%s",
		orgID, kapa.URL, recipientsLog, title,
	))
	if err := kapacitorSMTPSender(ctx, kapa.URL, recipients.list, title, message); err != nil {
		s.Logger.Error(fmt.Sprintf(
			"alert-group test send failed org_id=%s kapacitor_url=%s recipients=%s error=%v",
			orgID, kapa.URL, recipientsLog, err,
		))
		return alertGroupTestNotificationResponse{}, err
	}
	s.Logger.Info(fmt.Sprintf(
		"alert-group test send succeeded org_id=%s kapacitor_url=%s recipients=%s sent_count=%d",
		orgID, kapa.URL, recipientsLog, len(recipients.list),
	))

	return alertGroupTestNotificationResponse{
		ResolvedRecipientGroups: len(recipientGroups),
		ResolvedRecipients:      recipients.list,
		SentCount:               len(recipients.list),
	}, nil
}

func addDirectAlertGroupTestRecipients(out *recipientBucket, recipients []string) error {
	for _, recipient := range recipients {
		addr := strings.TrimSpace(recipient)
		if addr == "" {
			continue
		}
		parsed, err := mail.ParseAddress(addr)
		if err != nil || parsed.Address != addr {
			return fmt.Errorf("invalid recipient email: %s", addr)
		}
		out.add(addr)
	}
	return nil
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
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete kapacitor task returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
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

func (s *Service) getTargetProcessor(ctx context.Context, rule cloudhub.AlertGroupRule) TargetProcessor {
	if len(rule.URLTargetIDs) > 0 {
		return &URLTargetProcessor{Store: s.AlertGroupRules, URLStore: s.Store.URLMonitoring(serverContext(ctx)), OrgID: rule.OrgID, Ctx: serverContext(ctx)}
	}
	return &HostTargetProcessor{Store: s.AlertGroupRules}
}
