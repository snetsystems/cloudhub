package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
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
	Method          string `json:"method"`
	AlertRuleID     string `json:"alertRuleId,omitempty"`
}

// urlMonitoringTargetUpsertRequest is used by POST/PATCH /url-monitoring-targets.
// "name" is treated as a case-insensitive key for upsert on POST.
type urlMonitoringTargetUpsertRequest struct {
	Name            string `json:"name"`
	URL             string `json:"url"`
	Interval        string `json:"interval"`
	ResponseTimeout string `json:"responseTimeout"`
	Method          string `json:"method"`
	AlertRuleID     string `json:"alertRuleId,omitempty"`
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
			AlertRuleID:     t.AlertRuleID,
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
		encodeJSON(w, http.StatusOK, nil, s.Logger)
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

	if err := s.Store.URLMonitoring(ctx).Delete(ctx, id); err != nil {
		if err == cloudhub.ErrURLMonitoringNotFound {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if err := s.removeURLMonitoringFromCollector(ctx, m); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to remove url monitoring from collector: %v", err), s.Logger)
		return
	}
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

// AddURLMonitoringTarget adds a target (upsert by case-insensitive name), auto-creating
// the parent URLMonitoring record for the org if it does not yet exist.
func (s *Service) AddURLMonitoringTarget(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	orgID, ok := hasOrganizationContext(ctx)
	if !ok || strings.TrimSpace(orgID) == "" {
		Error(w, http.StatusUnauthorized, "organization context required", s.Logger)
		return
	}

	var req urlMonitoringTargetUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		invalidData(w, fmt.Errorf("name is required"), s.Logger)
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		invalidData(w, fmt.Errorf("url is required"), s.Logger)
		return
	}
	if strings.TrimSpace(req.Interval) == "" {
		req.Interval = "1m"
	}
	if strings.TrimSpace(req.ResponseTimeout) == "" {
		req.ResponseTimeout = "5s"
	}
	if strings.TrimSpace(req.Method) == "" {
		req.Method = "GET"
	}

	// Get existing or auto-create parent.
	m, err := s.Store.URLMonitoring(ctx).Get(ctx, orgID)
	if err == cloudhub.ErrURLMonitoringNotFound {
		collectorServer, _ := s.assignURLMonitoringCollector(ctx, orgID)
		m, err = s.Store.URLMonitoring(ctx).Add(ctx, &cloudhub.URLMonitoring{
			OrgID:           orgID,
			CollectorServer: collectorServer,
			Targets:         []cloudhub.URLMonitoringTarget{},
		})
		if err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}
	} else if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if m.Targets == nil {
		m.Targets = []cloudhub.URLMonitoringTarget{}
	}

	// Upsert by case-insensitive name.
	foundIdx := -1
	for i := range m.Targets {
		if strings.EqualFold(m.Targets[i].Name, req.Name) {
			foundIdx = i
			break
		}
	}

	if foundIdx >= 0 {
		t := &m.Targets[foundIdx]
		t.Name = req.Name
		t.URL = req.URL
		t.Interval = req.Interval
		t.ResponseTimeout = req.ResponseTimeout
		t.Method = req.Method
		t.AlertRuleID = req.AlertRuleID
	} else {
		m.Targets = append(m.Targets, cloudhub.URLMonitoringTarget{
			Name:            req.Name,
			URL:             req.URL,
			Interval:        req.Interval,
			ResponseTimeout: req.ResponseTimeout,
			Method:          req.Method,
			AlertRuleID:     req.AlertRuleID,
		})
	}

	updated, err := s.Store.URLMonitoring(ctx).Update(ctx, m)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.applyURLMonitoringToCollector(ctx, updated); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, toURLMonitoringResponse(updated), s.Logger)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		invalidData(w, fmt.Errorf("name is required"), s.Logger)
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		invalidData(w, fmt.Errorf("url is required"), s.Logger)
		return
	}
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

	found := false
	for i := range m.Targets {
		if m.Targets[i].ID != targetID {
			continue
		}
		m.Targets[i].Name = req.Name
		m.Targets[i].URL = req.URL
		m.Targets[i].Interval = req.Interval
		m.Targets[i].ResponseTimeout = req.ResponseTimeout
		m.Targets[i].Method = req.Method
		m.Targets[i].AlertRuleID = req.AlertRuleID
		found = true
		break
	}
	if !found {
		Error(w, http.StatusNotFound, "url monitoring target not found", s.Logger)
		return
	}

	updated, err := s.Store.URLMonitoring(ctx).Update(ctx, m)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.applyURLMonitoringToCollector(ctx, updated); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}
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

	found := false
	next := make([]cloudhub.URLMonitoringTarget, 0, len(m.Targets))
	for _, t := range m.Targets {
		if t.ID == targetID {
			found = true
			continue
		}
		next = append(next, t)
	}
	if !found {
		Error(w, http.StatusNotFound, "url monitoring target not found", s.Logger)
		return
	}

	m.Targets = next
	updated, err := s.Store.URLMonitoring(ctx).Update(ctx, m)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := s.applyURLMonitoringToCollector(ctx, updated); err != nil {
		Error(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to apply url monitoring to collector: %v", err), s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, toURLMonitoringResponse(updated), s.Logger)
}

func (s *Service) applyURLMonitoringToCollector(ctx context.Context, m *cloudhub.URLMonitoring) error {
	if m == nil {
		return nil
	}
	if m.CollectorServer == "" {
		// Collector assignment can fail during Create; telegraf apply is best-effort in that case.
		return nil
	}

	// Verify collector is ready.
	if err := s.InternalENV.Platform.VerifyCollectorReady(ctx, m.CollectorServer); err != nil {
		return fmt.Errorf("collector %q not ready: %w", m.CollectorServer, err)
	}

	fileName := fmt.Sprintf("url-monitoring/%s.conf", m.OrgID)
	// If there are no URL targets, remove the existing conf file instead of writing an empty one.
	if len(m.Targets) == 0 {
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

	// Deploy Telegraf config via Salt.
	if err := s.InternalENV.Platform.DeployTelegrafConfig(ctx, m.CollectorServer, fileName, conf); err != nil {
		return fmt.Errorf("failed to deploy telegraf config: %w", err)
	}

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

	return findLeastLoadedCollectorServer(orgID, collectorKeys, serverCount, orgToCollector), nil
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
