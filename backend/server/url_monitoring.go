package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type urlMonitoringResponse struct {
	ID              string                        `json:"id"`
	OrgID           string                        `json:"orgId"`
	CollectorServer string                        `json:"collectorServer,omitempty"`
	Targets         []urlMonitoringTargetResponse `json:"targets"`
}

type urlMonitoringTargetResponse struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	URL             string `json:"url"`
	Interval        string `json:"interval"`
	ResponseTimeout string `json:"responseTimeout"`
	Method          string   `json:"method"`
	AlertRuleIDs    []string `json:"alertRuleIds,omitempty"`
}

// urlMonitoringTargetUpsertRequest is used by POST/PATCH /url-monitoring-targets.
// "name" is treated as a case-insensitive key for upsert on POST.
type urlMonitoringTargetUpsertRequest struct {
	Name            string `json:"name"`
	URL             string `json:"url"`
	Interval        string `json:"interval"`
	ResponseTimeout string `json:"responseTimeout"`
	Method          string   `json:"method"`
	AlertRuleIDs    []string `json:"alertRuleIds,omitempty"`
}

func normalizeAndValidateURLMonitoringURL(rawURL string) (string, error) {
	normalized := strings.TrimSpace(rawURL)
	if normalized == "" {
		return "", fmt.Errorf("url is required")
	}
	// Telegraf TOML string literal breakage and config injection 방지.
	if strings.ContainsAny(normalized, "\r\n\"") {
		return "", fmt.Errorf("url contains invalid characters")
	}

	parsed, err := url.ParseRequestURI(normalized)
	if err != nil {
		return "", fmt.Errorf("url is invalid")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("url must start with http:// or https://")
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("url is invalid")
	}

	return normalized, nil
}

func toURLMonitoringResponse(m *cloudhub.URLMonitoring) urlMonitoringResponse {
	targets := make([]urlMonitoringTargetResponse, len(m.Targets))
	for i, t := range m.Targets {
		targets[i] = urlMonitoringTargetResponse{
			ID:              t.ID,
			Name:            t.Name,
			URL:             t.URL,
			Interval:        t.Interval,
			ResponseTimeout: t.ResponseTimeout,
			Method:          t.Method,
			AlertRuleIDs:    t.AlertRuleIDs,
		}
	}
	return urlMonitoringResponse{
		ID:              m.ID,
		OrgID:           m.OrgID,
		CollectorServer: m.CollectorServer,
		Targets:         targets,
	}
}

// GetURLMonitoring returns the URL monitoring config for the current org.
func (s *Service) GetURLMonitoring(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}

	m, err := s.Store.URLMonitoring(ctx).Get(ctx, orgID)
	if err == cloudhub.ErrURLMonitoringNotFound {
		encodeJSON(w, http.StatusOK, urlMonitoringResponse{
			Targets: []urlMonitoringTargetResponse{},
		}, s.Logger)
		return
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, toURLMonitoringResponse(m), s.Logger)
}

// DeleteURLMonitoring soft-deletes the URL monitoring config.
func (s *Service) DeleteURLMonitoring(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// Load before delete so we still know collectorServer / orgID for telegraf removal.
	m, err := s.Store.URLMonitoring(ctx).GetByID(ctx, id)
	if err != nil {
		if err == cloudhub.ErrURLMonitoringNotFound {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	// Remove conf first; only delete from DB if removal succeeds.
	if err := s.removeURLMonitoringFromCollector(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to remove url monitoring from collector: %v", err), s.Logger)
		return
	}

	if err := s.Store.URLMonitoring(ctx).Delete(ctx, id); err != nil {
		if err == cloudhub.ErrURLMonitoringNotFound {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	msg := fmt.Sprintf(MsgURLMonitoringDeleted.String(), id)
	s.logRegistration(ctx, "URLMonitoring", msg)
	w.WriteHeader(http.StatusNoContent)
}

// ApplyURLMonitoring generates a Telegraf conf and deploys it via Salt.
func (s *Service) ApplyURLMonitoring(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	m, err := s.Store.URLMonitoring(ctx).GetByID(ctx, id)
	if err == cloudhub.ErrURLMonitoringNotFound {
		notFound(w, id, s.Logger)
		return
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if err := s.applyURLMonitoringToCollector(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, map[string]string{
		"message":         "URL monitoring config applied successfully",
		"collectorServer": m.CollectorServer,
		"configFile":      fmt.Sprintf("url-monitoring/%s.conf", m.OrgID),
	}, s.Logger)
}

// AddURLMonitoringTarget adds a new target.
// Duplicate name (case-insensitive) is rejected with 409 Conflict.
// Parent URLMonitoring is auto-created for the org if it does not yet exist.
func (s *Service) AddURLMonitoringTarget(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}

	var req urlMonitoringTargetUpsertRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		invalidData(w, fmt.Errorf("name is required"), s.Logger)
		return
	}
	normalizedURL, err := normalizeAndValidateURLMonitoringURL(req.URL)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	req.URL = normalizedURL
	if strings.TrimSpace(req.Interval) == "" {
		req.Interval = "1m"
	}
	if strings.TrimSpace(req.ResponseTimeout) == "" {
		req.ResponseTimeout = "5s"
	}
	if strings.TrimSpace(req.Method) == "" {
		req.Method = "GET"
	}

	// Get existing parent, or prepare an in-memory one (not saved yet).
	m, err := s.Store.URLMonitoring(ctx).Get(ctx, orgID)
	parentExists := true
	if err == cloudhub.ErrURLMonitoringNotFound {
		parentExists = false
		collectorServer, _ := s.assignURLMonitoringCollector(ctx, orgID)
		m = &cloudhub.URLMonitoring{
			OrgID:           orgID,
			CollectorServer: collectorServer,
			Targets:         []cloudhub.URLMonitoringTarget{},
		}
	} else if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if m.Targets == nil {
		m.Targets = []cloudhub.URLMonitoringTarget{}
	}

	// POST is create-only: reject duplicate name (case-insensitive).
	for i := range m.Targets {
		if strings.EqualFold(m.Targets[i].Name, req.Name) {
			Error(w, http.StatusConflict, fmt.Sprintf("url monitoring target %q already exists", req.Name), s.Logger)
			return
		}
	}

	m.Targets = append(m.Targets, cloudhub.URLMonitoringTarget{
		Name:            req.Name,
		URL:             req.URL,
		Interval:        req.Interval,
		ResponseTimeout: req.ResponseTimeout,
		Method:          req.Method,
		AlertRuleIDs:    req.AlertRuleIDs,
	})

	// Deploy conf first; only persist to DB if deployment succeeds.
	if err := s.applyURLMonitoringToCollector(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}

	var result *cloudhub.URLMonitoring
	if !parentExists {
		result, err = s.Store.URLMonitoring(ctx).Add(ctx, m)
	} else {
		result, err = s.Store.URLMonitoring(ctx).Update(ctx, m)
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if len(req.AlertRuleIDs) > 0 {
		for _, t := range result.Targets {
			if strings.EqualFold(t.Name, req.Name) {
				for _, ruleID := range req.AlertRuleIDs {
					_ = s.autoLinkURLToAlertRule(ctx, t.ID, ruleID)
				}
				break
			}
		}
	}

	msg := fmt.Sprintf(MsgURLMonitoringTargetCreated.String(), req.Name)
	s.logRegistration(ctx, "URLMonitoringTarget", msg)
	encodeJSON(w, http.StatusOK, toURLMonitoringResponse(result), s.Logger)
}

// PatchURLMonitoringTarget updates a single target by target id using org context.
func (s *Service) PatchURLMonitoringTarget(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}
	targetID, err := paramStr("targetId", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req urlMonitoringTargetUpsertRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		invalidData(w, fmt.Errorf("name is required"), s.Logger)
		return
	}
	normalizedURL, err := normalizeAndValidateURLMonitoringURL(req.URL)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	req.URL = normalizedURL
	if strings.TrimSpace(req.Interval) == "" {
		req.Interval = "1m"
	}
	if strings.TrimSpace(req.ResponseTimeout) == "" {
		req.ResponseTimeout = "5s"
	}
	if strings.TrimSpace(req.Method) == "" {
		req.Method = "GET"
	}

	m, err := s.Store.URLMonitoring(ctx).Get(ctx, orgID)
	if err == cloudhub.ErrURLMonitoringNotFound {
		notFound(w, orgID, s.Logger)
		return
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if len(m.Targets) == 0 {
		Error(w, http.StatusNotFound, "url monitoring target not found", s.Logger)
		return
	}

	// Check duplicate name against other targets first.
	for i := range m.Targets {
		if m.Targets[i].ID == targetID {
			continue
		}
		if strings.EqualFold(m.Targets[i].Name, req.Name) {
			Error(w, http.StatusConflict, fmt.Sprintf("url monitoring target %q already exists", req.Name), s.Logger)
			return
		}
	}

	var oldAlertRuleIDs []string
	found := false
	for i := range m.Targets {
		if m.Targets[i].ID != targetID {
			continue
		}
		oldAlertRuleIDs = m.Targets[i].AlertRuleIDs
		m.Targets[i].Name = req.Name
		m.Targets[i].URL = req.URL
		m.Targets[i].Interval = req.Interval
		m.Targets[i].ResponseTimeout = req.ResponseTimeout
		m.Targets[i].Method = req.Method
		m.Targets[i].AlertRuleIDs = req.AlertRuleIDs
		found = true
		break
	}
	if !found {
		Error(w, http.StatusNotFound, "url monitoring target not found", s.Logger)
		return
	}

	// Deploy conf first; only persist to DB if deployment succeeds.
	if err := s.applyURLMonitoringToCollector(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}
	updated, err := s.Store.URLMonitoring(ctx).Update(ctx, m)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	oldMap := make(map[string]bool)
	for _, id := range oldAlertRuleIDs {
		oldMap[id] = true
	}
	newMap := make(map[string]bool)
	for _, id := range req.AlertRuleIDs {
		newMap[id] = true
	}

	for id := range oldMap {
		if !newMap[id] {
			_ = s.removeURLFromAlertRule(ctx, targetID, id)
		}
	}
	for id := range newMap {
		if !oldMap[id] {
			_ = s.autoLinkURLToAlertRule(ctx, targetID, id)
		}
	}

	msg := fmt.Sprintf(MsgURLMonitoringTargetModified.String(), req.Name)
	s.logRegistration(ctx, "URLMonitoringTarget", msg)
	encodeJSON(w, http.StatusOK, toURLMonitoringResponse(updated), s.Logger)
}

// DeleteURLMonitoringTarget deletes a single target by id using org context.
func (s *Service) DeleteURLMonitoringTarget(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}
	targetID, err := paramStr("targetId", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	m, err := s.Store.URLMonitoring(ctx).Get(ctx, orgID)
	if err == cloudhub.ErrURLMonitoringNotFound {
		notFound(w, orgID, s.Logger)
		return
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if len(m.Targets) == 0 {
		Error(w, http.StatusNotFound, "url monitoring target not found", s.Logger)
		return
	}

	var deletedName string
	var deletedAlertRuleIDs []string
	found := false
	next := make([]cloudhub.URLMonitoringTarget, 0, len(m.Targets))
	for _, t := range m.Targets {
		if t.ID == targetID {
			found = true
			deletedName = t.Name
			deletedAlertRuleIDs = t.AlertRuleIDs
			continue
		}
		next = append(next, t)
	}
	if !found {
		Error(w, http.StatusNotFound, "url monitoring target not found", s.Logger)
		return
	}

	m.Targets = next
	// Deploy conf first; only persist to DB if deployment succeeds.
	if err := s.applyURLMonitoringToCollector(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}
	updated, err := s.Store.URLMonitoring(ctx).Update(ctx, m)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	for _, id := range deletedAlertRuleIDs {
		_ = s.removeURLFromAlertRule(ctx, targetID, id)
	}

	logName := deletedName
	if strings.TrimSpace(logName) == "" {
		logName = targetID
	}
	msg := fmt.Sprintf(MsgURLMonitoringTargetDeleted.String(), logName)
	s.logRegistration(ctx, "URLMonitoringTarget", msg)
	encodeJSON(w, http.StatusOK, toURLMonitoringResponse(updated), s.Logger)
}

type urlMonitoringBulkAddRequest struct {
	Targets []urlMonitoringTargetUpsertRequest `json:"targets"`
}

type urlMonitoringBulkFailedItem struct {
	Name  string `json:"name"`
	Error string `json:"error"`
}

type urlMonitoringBulkAddResponse struct {
	Succeeded []string                      `json:"succeeded"`
	Failed    []urlMonitoringBulkFailedItem `json:"failed"`
}

// BulkAddURLMonitoringTargets upserts multiple targets in a single request.
// Validate-all-first: invalid rows are collected into Failed without blocking valid rows.
// conf is deployed once after all valid rows are applied.
// Returns 200 (all success), 207 (partial), or 400 (all invalid / empty).
func (s *Service) BulkAddURLMonitoringTargets(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}

	var req urlMonitoringBulkAddRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if len(req.Targets) == 0 {
		Error(w, http.StatusBadRequest, "targets is required", s.Logger)
		return
	}

	// Step 1: validate all rows, collect valid/failed.
	var validTargets []urlMonitoringTargetUpsertRequest
	var failed []urlMonitoringBulkFailedItem

	for _, t := range req.Targets {
		t.Name = strings.TrimSpace(t.Name)
		if t.Name == "" {
			failed = append(failed, urlMonitoringBulkFailedItem{Name: t.Name, Error: "name is required"})
			continue
		}
		normalizedURL, err := normalizeAndValidateURLMonitoringURL(t.URL)
		if err != nil {
			failed = append(failed, urlMonitoringBulkFailedItem{Name: t.Name, Error: err.Error()})
			continue
		}
		t.URL = normalizedURL
		if strings.TrimSpace(t.Interval) == "" {
			t.Interval = "1m"
		}
		if strings.TrimSpace(t.ResponseTimeout) == "" {
			t.ResponseTimeout = "5s"
		}
		if strings.TrimSpace(t.Method) == "" {
			t.Method = "GET"
		}
		validTargets = append(validTargets, t)
	}

	if len(validTargets) == 0 {
		encodeJSON(w, http.StatusBadRequest, urlMonitoringBulkAddResponse{
			Succeeded: []string{},
			Failed:    failed,
		}, s.Logger)
		return
	}

	// Step 2: load or create parent in-memory.
	m, err := s.Store.URLMonitoring(ctx).Get(ctx, orgID)
	parentExists := true
	if err == cloudhub.ErrURLMonitoringNotFound {
		parentExists = false
		collectorServer, _ := s.assignURLMonitoringCollector(ctx, orgID)
		m = &cloudhub.URLMonitoring{
			OrgID:           orgID,
			CollectorServer: collectorServer,
			Targets:         []cloudhub.URLMonitoringTarget{},
		}
	} else if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if m.Targets == nil {
		m.Targets = []cloudhub.URLMonitoringTarget{}
	}

	// Step 3: upsert valid targets by case-insensitive name.
	var succeeded []string
	for _, t := range validTargets {
		foundIdx := -1
		for i := range m.Targets {
			if strings.EqualFold(m.Targets[i].Name, t.Name) {
				foundIdx = i
				break
			}
		}
		if foundIdx >= 0 {
			existing := &m.Targets[foundIdx]
			existing.Name = t.Name
			existing.URL = t.URL
			existing.Interval = t.Interval
			existing.ResponseTimeout = t.ResponseTimeout
			existing.Method = t.Method
			existing.AlertRuleIDs = t.AlertRuleIDs
		} else {
			m.Targets = append(m.Targets, cloudhub.URLMonitoringTarget{
				Name:            t.Name,
				URL:             t.URL,
				Interval:        t.Interval,
				ResponseTimeout: t.ResponseTimeout,
				Method:          t.Method,
				AlertRuleIDs:    t.AlertRuleIDs,
			})
		}
		succeeded = append(succeeded, t.Name)
	}

	// Step 4: deploy conf once.
	// If deployment fails, all in-memory upserts are discarded (DB not updated).
	// The caller must retry the full batch.
	if err := s.applyURLMonitoringToCollector(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}

	// Step 5: persist to DB.
	if !parentExists {
		_, err = s.Store.URLMonitoring(ctx).Add(ctx, m)
	} else {
		_, err = s.Store.URLMonitoring(ctx).Update(ctx, m)
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	// Step 6: audit log.
	msg := fmt.Sprintf(MsgURLMonitoringTargetBulkCreated.String(), strconv.Itoa(len(succeeded)))
	s.logRegistration(ctx, "URLMonitoringTarget", msg)

	if len(succeeded) > 0 {
		latestM, _ := s.Store.URLMonitoring(ctx).Get(ctx, orgID)
		if latestM != nil {
			for _, reqTarget := range validTargets {
				if len(reqTarget.AlertRuleIDs) > 0 {
					for _, t := range latestM.Targets {
						if strings.EqualFold(t.Name, reqTarget.Name) {
							for _, ruleID := range reqTarget.AlertRuleIDs {
								_ = s.autoLinkURLToAlertRule(ctx, t.ID, ruleID)
							}
							break
						}
					}
				}
			}
		}
	}

	resp := urlMonitoringBulkAddResponse{
		Succeeded: succeeded,
		Failed:    failed,
	}
	if resp.Failed == nil {
		resp.Failed = []urlMonitoringBulkFailedItem{}
	}

	status := http.StatusOK
	if len(failed) > 0 {
		status = http.StatusMultiStatus
	}
	encodeJSON(w, status, resp, s.Logger)
}

func (s *Service) applyURLMonitoringToCollector(ctx context.Context, m *cloudhub.URLMonitoring) error {
	if m == nil {
		return nil
	}
	if m.CollectorServer == "" {
		// Collector assignment can fail during Create; telegraf apply is best-effort in that case.
		return nil
	}

	// Re-assign if stored collector is no longer in the active list.
	if activeKeys, _, err := s.InternalENV.Platform.GetActiveCollectors(ctx); err == nil && len(activeKeys) > 0 {
		isActive := false
		for _, k := range activeKeys {
			if k == m.CollectorServer {
				isActive = true
				break
			}
		}
		if !isActive {
			s.Logger.
				WithField("org", m.OrgID).
				WithField("stale_collector", m.CollectorServer).
				WithField("active_collectors", activeKeys).
				Info("URLMonitoring: stored collector not active, reassigning")
			if newCollector, err := s.assignURLMonitoringCollector(ctx, m.OrgID); err == nil && newCollector != "" {
				m.CollectorServer = newCollector
				if updated, err := s.Store.URLMonitoring(ctx).Get(ctx, m.OrgID); err == nil {
					updated.CollectorServer = newCollector
					_, _ = s.Store.URLMonitoring(ctx).Update(ctx, updated)
				}
			}
		}
	}

	s.Logger.
		WithField("collector", m.CollectorServer).
		WithField("org", m.OrgID).
		Info("URLMonitoring: verifying collector ready")
	// Verify collector is ready.
	if err := s.InternalENV.Platform.VerifyCollectorReady(ctx, m.CollectorServer); err != nil {
		return fmt.Errorf("collector %q not ready: %w", m.CollectorServer, err)
	}

	fileName := fmt.Sprintf("url-monitoring/%s.conf", m.OrgID)
	// If there are no URL targets, remove the existing conf file instead of writing an empty one.
	if len(m.Targets) == 0 {
		s.Logger.
			WithField("collector", m.CollectorServer).
			WithField("file", fileName).
			Info("URLMonitoring: removing telegraf config (no targets)")
		if err := s.InternalENV.Platform.RemoveTelegrafConfig(ctx, m.CollectorServer, fileName); err != nil {
			return fmt.Errorf("failed to remove telegraf config: %w", err)
		}
		if err := s.InternalENV.Platform.RestartTelegraf(ctx, m.CollectorServer); err != nil {
			s.Logger.WithField("error", err).Error("RestartTelegraf failed after remove")
		}
		return nil
	}

	// Look up organization name (used as database name and tenant tag).
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &m.OrgID})
	if err != nil {
		return fmt.Errorf("failed to get organization: %w", err)
	}

	influxURL := s.lookupInfluxURL(ctx)

	// Generate Telegraf conf.
	conf, err := s.generateURLMonitoringConf(ctx, m, influxURL, org.Name)
	if err != nil {
		return fmt.Errorf("failed to render telegraf config: %w", err)
	}

	s.Logger.
		WithField("collector", m.CollectorServer).
		WithField("file", fileName).
		WithField("targets", len(m.Targets)).
		Info("URLMonitoring: deploying telegraf config")
	// Deploy Telegraf config via Salt.
	if err := s.InternalENV.Platform.DeployTelegrafConfig(ctx, m.CollectorServer, fileName, conf); err != nil {
		return fmt.Errorf("failed to deploy telegraf config: %w", err)
	}
	s.Logger.
		WithField("collector", m.CollectorServer).
		WithField("file", fileName).
		Info("URLMonitoring: telegraf config deployed successfully")

	// Reload Telegraf.
	if err := s.InternalENV.Platform.RestartTelegraf(ctx, m.CollectorServer); err != nil {
		s.Logger.WithField("error", err).Error("RestartTelegraf failed after deploy")
	}
	return nil
}

func (s *Service) removeURLMonitoringFromCollector(ctx context.Context, m *cloudhub.URLMonitoring) error {
	if m == nil {
		return nil
	}
	if m.CollectorServer == "" {
		return nil
	}

	fileName := fmt.Sprintf("url-monitoring/%s.conf", m.OrgID)
	if err := s.InternalENV.Platform.RemoveTelegrafConfig(ctx, m.CollectorServer, fileName); err != nil {
		return fmt.Errorf("failed to remove telegraf config: %w", err)
	}
	if err := s.InternalENV.Platform.RestartTelegraf(ctx, m.CollectorServer); err != nil {
		s.Logger.WithField("error", err).Error("RestartTelegraf failed after remove")
	}
	return nil
}

// lookupInfluxURL returns the InfluxDB URL from the sources store, or a default.
func (s *Service) lookupInfluxURL(ctx context.Context) string {
	srcs, err := s.Store.Sources(ctx).All(ctx)
	if err != nil || len(srcs) == 0 {
		return "http://localhost:8086"
	}
	return srcs[0].URL
}

// generateURLMonitoringConf builds a Telegraf TOML conf string.
// orgName is used as the database name and tenant tag value.
func (s *Service) generateURLMonitoringConf(ctx context.Context, m *cloudhub.URLMonitoring, influxURL, orgName string) (string, error) {
	tm := s.InternalENV.TemplatesManager
	t, err := tm.Get(ctx, string(URLMonitoringTelegrafTemplateField))
	if err != nil {
		return "", fmt.Errorf("load template %q: %w", URLMonitoringTelegrafTemplateField, err)
	}
	cfg := s.InternalENV.URLMonitoringConfig
	return renderURLMonitoringConf(t.Template, m, influxURL, orgName, cfg.InsecureSkipVerify, cfg.TLSCA, cfg.TLSCert, cfg.TLSKey)
}

func renderURLMonitoringConf(templateString string, m *cloudhub.URLMonitoring, influxURL, orgName string, insecureSkipVerify bool, tlsCA, tlsCert, tlsKey string) (string, error) {
	type groupKey struct {
		Interval        string
		ResponseTimeout string
		Method          string
	}
	type inputGroup struct {
		Interval        string
		ResponseTimeout string
		Method          string
		URLs            []string
	}

	order := []groupKey{}
	groups := map[groupKey]*inputGroup{}
	for _, t := range m.Targets {
		k := groupKey{t.Interval, t.ResponseTimeout, t.Method}
		if g, ok := groups[k]; ok {
			g.URLs = append(g.URLs, t.URL)
		} else {
			order = append(order, k)
			groups[k] = &inputGroup{
				Interval:        t.Interval,
				ResponseTimeout: t.ResponseTimeout,
				Method:          t.Method,
				URLs:            []string{t.URL},
			}
		}
	}

	inputs := make([]inputGroup, len(order))
	for i, k := range order {
		inputs[i] = *groups[k]
	}

	templateService := &TemplateService{}
	conf, err := templateService.LoadTemplate(cloudhub.LoadTemplateConfig{
		Field:          URLMonitoringTelegrafTemplateField,
		TemplateString: templateString,
	}, []cloudhub.TemplateBlock{{
		Name: "main",
		Params: cloudhub.TemplateParamsMap{
			"Inputs":             inputs,
			"InsecureSkipVerify": insecureSkipVerify,
			"TLSCA":              tlsCA,
			"TLSCert":            tlsCert,
			"TLSKey":             tlsKey,
			"OrgName":            orgName,
			"InfluxURL":          influxURL,
		},
	}})
	if err != nil {
		return "", fmt.Errorf("render template %q: %w", URLMonitoringTelegrafTemplateField, err)
	}
	return conf, nil
}

// GetURLMonitoringConfig returns the generated Telegraf config content without deploying it.
func (s *Service) GetURLMonitoringConfig(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	m, err := s.Store.URLMonitoring(ctx).GetByID(ctx, id)
	if err == cloudhub.ErrURLMonitoringNotFound {
		notFound(w, id, s.Logger)
		return
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &m.OrgID})
	if err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to get organization: %v", err), s.Logger)
		return
	}

	influxURL := s.lookupInfluxURL(ctx)
	conf, err := s.generateURLMonitoringConf(ctx, m, influxURL, org.Name)
	if err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to render telegraf config: %v", err), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, map[string]string{"config": conf}, s.Logger)
}

// assignURLMonitoringCollector picks the least-loaded collector server.
func (s *Service) assignURLMonitoringCollector(ctx context.Context, orgID string) (string, error) {
	collectorKeys, _, err := s.InternalENV.Platform.GetActiveCollectors(ctx)
	s.Logger.
		WithField("org", orgID).
		WithField("collectors", collectorKeys).
		WithField("error", err).
		Info("URLMonitoring: GetActiveCollectors result")
	if err != nil || len(collectorKeys) == 0 {
		return "", fmt.Errorf("no active collectors: %w", err)
	}

	all, err := s.Store.URLMonitoring(ctx).All(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to list url monitoring: %w", err)
	}

	serverCount := map[string]int{}
	orgToCollector := map[string]string{}
	for _, m := range all {
		serverCount[m.CollectorServer]++
		orgToCollector[m.OrgID] = m.CollectorServer
	}

	selected := findLeastLoadedCollectorServer(orgID, collectorKeys, serverCount, orgToCollector)
	s.Logger.
		WithField("org", orgID).
		WithField("selected", selected).
		Info("URLMonitoring: collector selected")
	return selected, nil
}

// GetURLMonitoringStatus checks whether the Telegraf config file exists on the collector.
func (s *Service) GetURLMonitoringStatus(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	m, err := s.Store.URLMonitoring(ctx).GetByID(ctx, id)
	if err == cloudhub.ErrURLMonitoringNotFound {
		notFound(w, id, s.Logger)
		return
	}
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if m.CollectorServer == "" {
		encodeJSON(w, http.StatusOK, map[string]interface{}{
			"fileExists":      false,
			"collectorServer": "",
			"filePath":        "",
			"reason":          "no collector assigned",
		}, s.Logger)
		return
	}

	filePath := path.Join(s.InternalENV.URLMonitoringConfig.TelegrafPath, "url-monitoring", m.OrgID+".conf")
	exists, err := s.InternalENV.Platform.CheckFileExists(ctx, m.CollectorServer, filePath)
	if err != nil {
		s.Logger.WithField("error", err).Error("CheckFileExists failed")
		encodeJSON(w, http.StatusOK, map[string]interface{}{
			"fileExists":      false,
			"collectorServer": m.CollectorServer,
			"filePath":        filePath,
			"reason":          err.Error(),
		}, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, map[string]interface{}{
		"fileExists":      exists,
		"collectorServer": m.CollectorServer,
		"filePath":        filePath,
	}, s.Logger)
}

// autoLinkURLToAlertRule adds a targetID to an AlertGroupRule's URL targets and redeploys it.
func (s *Service) autoLinkURLToAlertRule(ctx context.Context, targetID string, ruleID string) error {
	if strings.TrimSpace(ruleID) == "" {
		return nil
	}
	rule, err := s.AlertGroupRules.Get(ctx, ruleID)
	if err != nil {
		s.Logger.WithField("rule", ruleID).WithField("error", err).Error("autoLinkURLToAlertRule: failed to get rule")
		return err
	}
	existingTargets, err := s.AlertGroupRules.URLTargetIDs(ctx, ruleID)
	if err != nil {
		s.Logger.WithField("rule", ruleID).WithField("error", err).Error("autoLinkURLToAlertRule: failed to get targets")
		return err
	}
	for _, t := range existingTargets {
		if t == targetID {
			return nil
		}
	}
	existingTargets = append(existingTargets, targetID)
	err = s.AlertGroupRules.SetURLTargets(ctx, ruleID, existingTargets)
	if err != nil {
		s.Logger.WithField("rule", ruleID).WithField("error", err).Error("autoLinkURLToAlertRule: failed to set targets")
		return err
	}
	
	return s.regenRule(ctx, rule)
}

// removeURLFromAlertRule removes a targetID from an AlertGroupRule's URL targets and redeploys it.
func (s *Service) removeURLFromAlertRule(ctx context.Context, targetID string, ruleID string) error {
	if strings.TrimSpace(ruleID) == "" {
		return nil
	}
	rule, err := s.AlertGroupRules.Get(ctx, ruleID)
	if err != nil {
		s.Logger.WithField("rule", ruleID).WithField("error", err).Error("removeURLFromAlertRule: failed to get rule")
		return err // Rule might be deleted already
	}
	existingTargets, err := s.AlertGroupRules.URLTargetIDs(ctx, ruleID)
	if err != nil {
		s.Logger.WithField("rule", ruleID).WithField("error", err).Error("removeURLFromAlertRule: failed to get targets")
		return err
	}
	
	var newTargets []string
	found := false
	for _, t := range existingTargets {
		if t == targetID {
			found = true
		} else {
			newTargets = append(newTargets, t)
		}
	}
	
	if !found {
		return nil
	}
	
	err = s.AlertGroupRules.SetURLTargets(ctx, ruleID, newTargets)
	if err != nil {
		s.Logger.WithField("rule", ruleID).WithField("error", err).Error("removeURLFromAlertRule: failed to set targets")
		return err
	}
	
	return s.regenRule(ctx, rule)
}
