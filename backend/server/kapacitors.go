package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/bouk/httprouter"
	"github.com/influxdata/kapacitor/client/v1"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	kapa "github.com/snetsystems/cloudhub/backend/kapacitor"
)

type postKapacitorRequest struct {
	Name               *string `json:"name"`               // User facing name of kapacitor instance.; Required: true
	URL                *string `json:"url"`                // URL for the kapacitor backend (e.g. http://localhost:9092);/ Required: true
	Username           string  `json:"username,omitempty"` // Username for authentication to kapacitor
	Password           string  `json:"password,omitempty"`
	InsecureSkipVerify bool    `json:"insecureSkipVerify"` // InsecureSkipVerify as true means any certificate presented by the kapacitor is accepted.
	Active             bool    `json:"active"`
	Organization       string  `json:"organization"` // Organization is the organization ID that resource belongs to
}

func (p *postKapacitorRequest) Valid(defaultOrgID string) error {
	if p.Name == nil || p.URL == nil {
		return fmt.Errorf("name and url required")
	}

	if p.Organization == "" {
		p.Organization = defaultOrgID
	}

	url, err := url.ParseRequestURI(*p.URL)
	if err != nil {
		return fmt.Errorf("invalid source URI: %v", err)
	}
	if len(url.Scheme) == 0 {
		return fmt.Errorf("Invalid URL; no URL scheme defined")
	}

	return nil
}

type kapaLinks struct {
	Proxy string `json:"proxy"` // URL location of proxy endpoint for this source
	Self  string `json:"self"`  // Self link mapping to this resource
	Rules string `json:"rules"` // Rules link for defining roles alerts for kapacitor
	Tasks string `json:"tasks"` // Tasks link to define a task against the proxy
	Ping  string `json:"ping"`  // Ping path to kapacitor
}

type kapacitor struct {
	ID                 int       `json:"id,string"`          // Unique identifier representing a kapacitor instance.
	Name               string    `json:"name"`               // User facing name of kapacitor instance.
	URL                string    `json:"url"`                // URL for the kapacitor backend (e.g. http://localhost:9092)
	Username           string    `json:"username,omitempty"` // Username for authentication to kapacitor
	Password           string    `json:"password,omitempty"`
	InsecureSkipVerify bool      `json:"insecureSkipVerify"` // InsecureSkipVerify as true means any certificate presented by the kapacitor is accepted.
	Active             bool      `json:"active"`
	Links              kapaLinks `json:"links"` // Links are URI locations related to kapacitor
}

// NewKapacitor adds valid kapacitor store store.
func (s *Service) NewKapacitor(w http.ResponseWriter, r *http.Request) {
	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	_, err = s.Store.Sources(ctx).Get(ctx, srcID)
	if err != nil {
		notFound(w, srcID, s.Logger)
		return
	}

	var req postKapacitorRequest
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	if err := req.Valid(defaultOrg.ID); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	srv := cloudhub.Server{
		SrcID:              srcID,
		Name:               *req.Name,
		Username:           req.Username,
		Password:           req.Password,
		InsecureSkipVerify: req.InsecureSkipVerify,
		URL:                *req.URL,
		Active:             req.Active,
		Organization:       req.Organization,
	}

	if srv, err = s.Store.Servers(ctx).Add(ctx, srv); err != nil {
		msg := fmt.Errorf("Error storing kapacitor %v: %v", req, err)
		unknownErrorWithMessage(w, msg, s.Logger)
		return
	}

	if srv.Active {
		// make sure that there is at most one active kapacitor
		err := s.deactivateOtherKapacitors(ctx, srcID, srv.ID)
		if err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorCreated.String(), srv.Name)
	s.logRegistration(ctx, "Kapacitors", msg)

	res := newKapacitor(srv)
	location(w, res.Links.Self)
	encodeJSON(w, http.StatusCreated, res, s.Logger)
}

func newKapacitor(srv cloudhub.Server) kapacitor {
	httpAPISrcs := "/cloudhub/v1/sources"
	return kapacitor{
		ID:                 srv.ID,
		Name:               srv.Name,
		Username:           srv.Username,
		URL:                srv.URL,
		Active:             srv.Active,
		InsecureSkipVerify: srv.InsecureSkipVerify,
		Links: kapaLinks{
			Self:  fmt.Sprintf("%s/%d/kapacitors/%d", httpAPISrcs, srv.SrcID, srv.ID),
			Proxy: fmt.Sprintf("%s/%d/kapacitors/%d/proxy", httpAPISrcs, srv.SrcID, srv.ID),
			Rules: fmt.Sprintf("%s/%d/kapacitors/%d/rules", httpAPISrcs, srv.SrcID, srv.ID),
			Tasks: fmt.Sprintf("%s/%d/kapacitors/%d/proxy?path=/kapacitor/v1/tasks", httpAPISrcs, srv.SrcID, srv.ID),
			Ping:  fmt.Sprintf("%s/%d/kapacitors/%d/proxy?path=/kapacitor/v1/ping", httpAPISrcs, srv.SrcID, srv.ID),
		},
	}
}

type kapacitors struct {
	Kapacitors []kapacitor `json:"kapacitors"`
}

// Kapacitors retrieves all kapacitors from store.
func (s *Service) Kapacitors(w http.ResponseWriter, r *http.Request) {
	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	mrSrvs, err := s.Store.Servers(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, "Error loading kapacitors", s.Logger)
		return
	}

	srvs := []kapacitor{}
	for _, srv := range mrSrvs {
		if srv.SrcID == srcID && srv.Type == "" {
			srvs = append(srvs, newKapacitor(srv))
		}
	}

	res := kapacitors{
		Kapacitors: srvs,
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// KapacitorsID retrieves a kapacitor with ID from store.
func (s *Service) KapacitorsID(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID || srv.Type != "" {
		notFound(w, id, s.Logger)
		return
	}

	res := newKapacitor(srv)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// RemoveKapacitor deletes kapacitor from store.
func (s *Service) RemoveKapacitor(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID || srv.Type != "" {
		notFound(w, id, s.Logger)
		return
	}

	if err = s.Store.Servers(ctx).Delete(ctx, srv); err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorDeleted.String(), srv.Name)
	s.logRegistration(ctx, "Kapacitors", msg)

	w.WriteHeader(http.StatusNoContent)
}

type patchKapacitorRequest struct {
	Name               *string `json:"name,omitempty"`     // User facing name of kapacitor instance.
	URL                *string `json:"url,omitempty"`      // URL for the kapacitor
	Username           *string `json:"username,omitempty"` // Username for kapacitor auth
	Password           *string `json:"password,omitempty"`
	InsecureSkipVerify *bool   `json:"insecureSkipVerify"` // InsecureSkipVerify as true means any certificate presented by the kapacitor is accepted.
	Active             *bool   `json:"active"`
}

func (p *patchKapacitorRequest) Valid() error {
	if p.URL != nil {
		url, err := url.ParseRequestURI(*p.URL)
		if err != nil {
			return fmt.Errorf("invalid source URI: %v", err)
		}
		if len(url.Scheme) == 0 {
			return fmt.Errorf("Invalid URL; no URL scheme defined")
		}
	}
	return nil
}

// UpdateKapacitor incrementally updates a kapacitor definition in the store
func (s *Service) UpdateKapacitor(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID || srv.Type != "" {
		notFound(w, id, s.Logger)
		return
	}

	var req patchKapacitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.Valid(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	activateKapacitor := false

	if req.Name != nil {
		srv.Name = *req.Name
	}
	if req.URL != nil {
		srv.URL = *req.URL
	}
	if req.Password != nil {
		srv.Password = *req.Password
	}
	if req.Username != nil {
		srv.Username = *req.Username
	}
	if req.InsecureSkipVerify != nil {
		srv.InsecureSkipVerify = *req.InsecureSkipVerify
	}
	if req.Active != nil {
		activateKapacitor = *req.Active
		srv.Active = *req.Active
	}

	if err := s.Store.Servers(ctx).Update(ctx, srv); err != nil {
		msg := fmt.Sprintf("Error updating kapacitor ID %d", id)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	if activateKapacitor {
		// make sure that there is at most one active kapacitor
		err := s.deactivateOtherKapacitors(ctx, srcID, id)
		if err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorModified.String(), srv.Name)
	s.logRegistration(ctx, "Kapacitors", msg)

	res := newKapacitor(srv)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// deactivateOtherKapacitors deactivates all other kapacitors excluding the one with supplied ID
func (s *Service) deactivateOtherKapacitors(ctx context.Context, srcID int, ID int) error {
	serversStore := s.Store.Servers(ctx)
	mrSrvs, err := serversStore.All(ctx)
	if err != nil {
		return errors.New("error loading kapacitors for deactivation")
	}
	var deactivationErrors []string = nil
	var deactivationError error = nil
	for _, srv := range mrSrvs {
		if srv.SrcID == srcID && srv.Type == "" && srv.ID != ID {
			if srv.Active {
				srv.Active = false
				if err := serversStore.Update(ctx, srv); err != nil {
					deactivationErrors = append(deactivationErrors, err.Error())
					deactivationError = err
					continue
				}
			}
		}
	}
	if len(deactivationErrors) > 1 {
		return fmt.Errorf(strings.Join(deactivationErrors, "\n"))
	}
	return deactivationError
}

// KapacitorRulesPost proxies POST to kapacitor
func (s *Service) KapacitorRulesPost(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID {
		notFound(w, id, s.Logger)
		return
	}

	c := kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify)

	var req cloudhub.AlertRule
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	// TODO: validate this data
	/*
		if err := req.Valid(); err != nil {
			invalidData(w, err)
			return
		}
	*/

	if req.Name == "" {
		req.Name = req.ID
	}

	req.ID = ""
	task, err := c.Create(ctx, req)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorRuleCreated.String(), task.Rule.Name, srv.Name)
	s.logRegistration(ctx, "Kapacitors Rules", msg)

	res := newAlertResponse(task, srv.SrcID, srv.ID)
	location(w, res.Links.Self)
	encodeJSON(w, http.StatusCreated, res, s.Logger)
}

type alertLinks struct {
	Self      string `json:"self"`
	Kapacitor string `json:"kapacitor"`
	Output    string `json:"output"`
}

type alertResponse struct {
	cloudhub.AlertRule
	Links alertLinks `json:"links"`
}

// newAlertResponse formats task into an alertResponse
func newAlertResponse(task *kapa.Task, srcID, kapaID int) *alertResponse {
	res := &alertResponse{
		AlertRule: task.Rule,
		Links: alertLinks{
			Self:      fmt.Sprintf("/cloudhub/v1/sources/%d/kapacitors/%d/rules/%s", srcID, kapaID, task.ID),
			Kapacitor: fmt.Sprintf("/cloudhub/v1/sources/%d/kapacitors/%d/proxy?path=%s", srcID, kapaID, url.QueryEscape(task.Href)),
			Output:    fmt.Sprintf("/cloudhub/v1/sources/%d/kapacitors/%d/proxy?path=%s", srcID, kapaID, url.QueryEscape(task.HrefOutput)),
		},
	}

	if res.AlertNodes.Alerta == nil {
		res.AlertNodes.Alerta = []*cloudhub.Alerta{}
	}

	for i, a := range res.AlertNodes.Alerta {
		if a.Service == nil {
			a.Service = []string{}
			res.AlertNodes.Alerta[i] = a
		}
	}

	if res.AlertNodes.Email == nil {
		res.AlertNodes.Email = []*cloudhub.Email{}
	}

	for i, a := range res.AlertNodes.Email {
		if a.To == nil {
			a.To = []string{}
			res.AlertNodes.Email[i] = a
		}
	}

	if res.AlertNodes.Exec == nil {
		res.AlertNodes.Exec = []*cloudhub.Exec{}
	}

	for i, a := range res.AlertNodes.Exec {
		if a.Command == nil {
			a.Command = []string{}
			res.AlertNodes.Exec[i] = a
		}
	}

	if res.AlertNodes.Kafka == nil {
		res.AlertNodes.Kafka = []*cloudhub.Kafka{}
	}

	if res.AlertNodes.Log == nil {
		res.AlertNodes.Log = []*cloudhub.Log{}
	}

	if res.AlertNodes.OpsGenie == nil {
		res.AlertNodes.OpsGenie = []*cloudhub.OpsGenie{}
	}

	for i, a := range res.AlertNodes.OpsGenie {
		if a.Teams == nil {
			a.Teams = []string{}
			res.AlertNodes.OpsGenie[i] = a
		}

		if a.Recipients == nil {
			a.Recipients = []string{}
			res.AlertNodes.OpsGenie[i] = a
		}
	}

	if res.AlertNodes.OpsGenie2 == nil {
		res.AlertNodes.OpsGenie2 = []*cloudhub.OpsGenie{}
	}

	for i, a := range res.AlertNodes.OpsGenie2 {
		if a.Teams == nil {
			a.Teams = []string{}
			res.AlertNodes.OpsGenie2[i] = a
		}

		if a.Recipients == nil {
			a.Recipients = []string{}
			res.AlertNodes.OpsGenie2[i] = a
		}
	}

	if res.AlertNodes.PagerDuty == nil {
		res.AlertNodes.PagerDuty = []*cloudhub.PagerDuty{}
	}

	if res.AlertNodes.PagerDuty2 == nil {
		res.AlertNodes.PagerDuty2 = []*cloudhub.PagerDuty{}
	}

	if res.AlertNodes.Posts == nil {
		res.AlertNodes.Posts = []*cloudhub.Post{}
	}

	for i, a := range res.AlertNodes.Posts {
		if a.Headers == nil {
			a.Headers = map[string]string{}
			res.AlertNodes.Posts[i] = a
		}
	}

	if res.AlertNodes.Pushover == nil {
		res.AlertNodes.Pushover = []*cloudhub.Pushover{}
	}

	if res.AlertNodes.Sensu == nil {
		res.AlertNodes.Sensu = []*cloudhub.Sensu{}
	}

	for i, a := range res.AlertNodes.Sensu {
		if a.Handlers == nil {
			a.Handlers = []string{}
			res.AlertNodes.Sensu[i] = a
		}
	}

	if res.AlertNodes.Slack == nil {
		res.AlertNodes.Slack = []*cloudhub.Slack{}
	}

	if res.AlertNodes.Talk == nil {
		res.AlertNodes.Talk = []*cloudhub.Talk{}
	}

	if res.AlertNodes.TCPs == nil {
		res.AlertNodes.TCPs = []*cloudhub.TCP{}
	}

	if res.AlertNodes.Telegram == nil {
		res.AlertNodes.Telegram = []*cloudhub.Telegram{}
	}

	if res.AlertNodes.VictorOps == nil {
		res.AlertNodes.VictorOps = []*cloudhub.VictorOps{}
	}

	if res.Query != nil {
		if res.Query.ID == "" {
			res.Query.ID = res.ID
		}

		if res.Query.Fields == nil {
			res.Query.Fields = make([]cloudhub.Field, 0)
		}

		if res.Query.GroupBy.Tags == nil {
			res.Query.GroupBy.Tags = make([]string, 0)
		}

		if res.Query.Tags == nil {
			res.Query.Tags = make(map[string][]string)
		}
	}
	return res
}

// newAlertResponseWithURL formats task into an alertResponse
func newAlertResponseWithURL(task *kapa.Task) *alertResponse {
	res := &alertResponse{
		AlertRule: task.Rule,
		Links:     alertLinks{},
	}

	if res.AlertNodes.Alerta == nil {
		res.AlertNodes.Alerta = []*cloudhub.Alerta{}
	}

	for i, a := range res.AlertNodes.Alerta {
		if a.Service == nil {
			a.Service = []string{}
			res.AlertNodes.Alerta[i] = a
		}
	}

	if res.AlertNodes.Email == nil {
		res.AlertNodes.Email = []*cloudhub.Email{}
	}

	for i, a := range res.AlertNodes.Email {
		if a.To == nil {
			a.To = []string{}
			res.AlertNodes.Email[i] = a
		}
	}

	if res.AlertNodes.Exec == nil {
		res.AlertNodes.Exec = []*cloudhub.Exec{}
	}

	for i, a := range res.AlertNodes.Exec {
		if a.Command == nil {
			a.Command = []string{}
			res.AlertNodes.Exec[i] = a
		}
	}

	if res.AlertNodes.Kafka == nil {
		res.AlertNodes.Kafka = []*cloudhub.Kafka{}
	}

	if res.AlertNodes.Log == nil {
		res.AlertNodes.Log = []*cloudhub.Log{}
	}

	if res.AlertNodes.OpsGenie == nil {
		res.AlertNodes.OpsGenie = []*cloudhub.OpsGenie{}
	}

	for i, a := range res.AlertNodes.OpsGenie {
		if a.Teams == nil {
			a.Teams = []string{}
			res.AlertNodes.OpsGenie[i] = a
		}

		if a.Recipients == nil {
			a.Recipients = []string{}
			res.AlertNodes.OpsGenie[i] = a
		}
	}

	if res.AlertNodes.OpsGenie2 == nil {
		res.AlertNodes.OpsGenie2 = []*cloudhub.OpsGenie{}
	}

	for i, a := range res.AlertNodes.OpsGenie2 {
		if a.Teams == nil {
			a.Teams = []string{}
			res.AlertNodes.OpsGenie2[i] = a
		}

		if a.Recipients == nil {
			a.Recipients = []string{}
			res.AlertNodes.OpsGenie2[i] = a
		}
	}

	if res.AlertNodes.PagerDuty == nil {
		res.AlertNodes.PagerDuty = []*cloudhub.PagerDuty{}
	}

	if res.AlertNodes.PagerDuty2 == nil {
		res.AlertNodes.PagerDuty2 = []*cloudhub.PagerDuty{}
	}

	if res.AlertNodes.Posts == nil {
		res.AlertNodes.Posts = []*cloudhub.Post{}
	}

	for i, a := range res.AlertNodes.Posts {
		if a.Headers == nil {
			a.Headers = map[string]string{}
			res.AlertNodes.Posts[i] = a
		}
	}

	if res.AlertNodes.Pushover == nil {
		res.AlertNodes.Pushover = []*cloudhub.Pushover{}
	}

	if res.AlertNodes.Sensu == nil {
		res.AlertNodes.Sensu = []*cloudhub.Sensu{}
	}

	for i, a := range res.AlertNodes.Sensu {
		if a.Handlers == nil {
			a.Handlers = []string{}
			res.AlertNodes.Sensu[i] = a
		}
	}

	if res.AlertNodes.Slack == nil {
		res.AlertNodes.Slack = []*cloudhub.Slack{}
	}

	if res.AlertNodes.Talk == nil {
		res.AlertNodes.Talk = []*cloudhub.Talk{}
	}

	if res.AlertNodes.TCPs == nil {
		res.AlertNodes.TCPs = []*cloudhub.TCP{}
	}

	if res.AlertNodes.Telegram == nil {
		res.AlertNodes.Telegram = []*cloudhub.Telegram{}
	}

	if res.AlertNodes.VictorOps == nil {
		res.AlertNodes.VictorOps = []*cloudhub.VictorOps{}
	}

	if res.Query != nil {
		if res.Query.ID == "" {
			res.Query.ID = res.ID
		}

		if res.Query.Fields == nil {
			res.Query.Fields = make([]cloudhub.Field, 0)
		}

		if res.Query.GroupBy.Tags == nil {
			res.Query.GroupBy.Tags = make([]string, 0)
		}

		if res.Query.Tags == nil {
			res.Query.Tags = make(map[string][]string)
		}
	}
	return res
}

// ValidRuleRequest checks if the requested rule change is valid
func ValidRuleRequest(rule cloudhub.AlertRule) error {
	if rule.Query == nil {
		return fmt.Errorf("invalid alert rule: no query defined")
	}
	var hasFuncs bool
	for _, f := range rule.Query.Fields {
		if f.Type == "func" && len(f.Args) > 0 {
			hasFuncs = true
		}
	}
	// All kapacitor rules with functions must have a window that is applied
	// every amount of time
	if rule.Every == "" && hasFuncs {
		return fmt.Errorf(`invalid alert rule: functions require an "every" window`)
	}
	return nil
}

// KapacitorRulesPut proxies PATCH to kapacitor
func (s *Service) KapacitorRulesPut(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID {
		notFound(w, id, s.Logger)
		return
	}

	tid := httprouter.GetParamFromContext(ctx, "tid")
	c := kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify)
	var req cloudhub.AlertRule
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	// TODO: validate this data
	/*
		if err := req.Valid(); err != nil {
			invalidData(w, err)
			return
		}
	*/

	// Check if the rule exists and is scoped correctly
	if _, err = c.Get(ctx, tid); err != nil {
		if err == cloudhub.ErrAlertNotFound {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	// Replace alert completely with this new alert.
	req.ID = tid
	task, err := c.Update(ctx, c.Href(tid), req)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorRuleModified.String(), task.Rule.Name, srv.Name)
	s.logRegistration(ctx, "Kapacitors Rules", msg)

	res := newAlertResponse(task, srv.SrcID, srv.ID)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// KapacitorStatus is the current state of a running task
type KapacitorStatus struct {
	Status string `json:"status"`
}

// Valid check if the kapacitor status is enabled or disabled
func (k *KapacitorStatus) Valid() error {
	if k.Status == "enabled" || k.Status == "disabled" {
		return nil
	}
	return fmt.Errorf("Invalid Kapacitor status: %s", k.Status)
}

// KapacitorRulesStatus proxies PATCH to kapacitor to enable/disable tasks
func (s *Service) KapacitorRulesStatus(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID {
		notFound(w, id, s.Logger)
		return
	}

	tid := httprouter.GetParamFromContext(ctx, "tid")
	c := kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify)

	var req KapacitorStatus
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if err := req.Valid(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// Check if the rule exists and is scoped correctly
	_, err = c.Get(ctx, tid)
	if err != nil {
		if err == cloudhub.ErrAlertNotFound {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var task *kapa.Task
	var ruleStatus string
	if req.Status == "enabled" {
		task, err = c.Enable(ctx, c.Href(tid))
		ruleStatus = "activated"
	} else {
		task, err = c.Disable(ctx, c.Href(tid))
		ruleStatus = "deactivated"
	}

	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)

		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorRuleStatus.String(), task.Rule.Name, ruleStatus, srv.Name)
	s.logRegistration(ctx, "Kapacitors Rules", msg)

	res := newAlertResponse(task, srv.SrcID, srv.ID)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// KapacitorRulesGet retrieves all rules
func (s *Service) KapacitorRulesGet(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID {
		notFound(w, id, s.Logger)
		return
	}

	c := kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify)
	tasks, err := c.All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := allAlertsResponse{
		Rules: []*alertResponse{},
	}
	for _, task := range tasks {
		ar := newAlertResponse(task, srv.SrcID, srv.ID)
		res.Rules = append(res.Rules, ar)
	}
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

type allAlertsResponse struct {
	Rules []*alertResponse `json:"rules"`
}

// KapacitorRulesID retrieves specific task
func (s *Service) KapacitorRulesID(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID {
		notFound(w, id, s.Logger)
		return
	}
	tid := httprouter.GetParamFromContext(ctx, "tid")

	c := kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify)

	// Check if the rule exists within scope
	task, err := c.Get(ctx, tid)
	if err != nil {
		if err == cloudhub.ErrAlertNotFound {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := newAlertResponse(task, srv.SrcID, srv.ID)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// KapacitorRulesDelete proxies DELETE to kapacitor
func (s *Service) KapacitorRulesDelete(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("kid", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	srcID, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	srv, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil || srv.SrcID != srcID {
		notFound(w, id, s.Logger)
		return
	}

	c := kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify)

	tid := httprouter.GetParamFromContext(ctx, "tid")
	// Check if the rule is linked to this server and kapacitor
	task, err := c.Get(ctx, tid)
	if err != nil {
		if err == cloudhub.ErrAlertNotFound {
			notFound(w, id, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if err := c.Delete(ctx, c.Href(tid)); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorRuleDeleted.String(), task.Rule.Name, srv.Name)
	s.logRegistration(ctx, "Kapacitors Rules", msg)

	w.WriteHeader(http.StatusNoContent)
}

// CreateKapacitorTask proxies POST to kapacitor
func (s *Service) CreateKapacitorTask(w http.ResponseWriter, r *http.Request) {
	var req cloudhub.AutoGeneratePredictionRule
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	ctx := r.Context()
	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &req.Organization})
	if err != nil {
		notFound(w, err.Error(), s.Logger)
		return
	}
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &req.Organization})
	if err != nil {
		notFound(w, err.Error(), s.Logger)
		return
	}

	c := kapa.NewClient(deviceOrg.AIKapacitor.KapaURL, deviceOrg.AIKapacitor.Username, deviceOrg.AIKapacitor.Password, deviceOrg.AIKapacitor.InsecureSkipVerify)

	if req.Name == "" {
		req.Name = org.Name
	}
	if req.OrganizationName == "" {
		req.OrganizationName = org.Name
	}
	if req.TaskTemplate == "" {
		req.TaskTemplate = PredictionTaskField
	}

	alertServices, err := kapa.ParseAlertForTarget(req.AlertRule, nil)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	tmplParams := []cloudhub.TemplateBlock{
		{
			Name: "main", Params: cloudhub.TemplateParamsMap{"OrgName": req.OrganizationName,
				"Message":              req.Message,
				"RetentionPolicy":      RetentionPolicy,
				"PredictMode":          req.PredictMode,
				"PredictModeCondition": req.PredictModeCondition,
				"AlertServices":        alertServices,
				"Group":                "{{.Group}}",
				"Details":              req.Details},
		},
	}

	tm := s.InternalENV.TemplatesManager
	t, err := tm.Get(ctx, string(PredictionTaskField))
	templateService := &TemplateService{}
	script, err := templateService.LoadTemplate(cloudhub.LoadTemplateConfig{
		Field:          PredictionTaskField,
		TemplateString: t.Template,
	}, tmplParams)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	kapaID := cloudhub.PredictScriptPrefix + org.ID
	DBRPs := []client.DBRP{{Database: "Default", RetentionPolicy: RetentionPolicy}}
	if org.ID != "default" {
		DBRPs = append(DBRPs, client.DBRP{Database: org.Name, RetentionPolicy: RetentionPolicy})
	}
	status := client.Enabled
	if req.Status != "" {
		if err := status.UnmarshalText([]byte(req.Status)); err != nil {
			invalidData(w, err, s.Logger)
			return
		}
	}
	createTaskOptions := &client.CreateTaskOptions{
		ID:         kapaID,
		Type:       client.StreamTask,
		DBRPs:      DBRPs,
		TICKscript: script,
		Status:     status,
	}

	task, err := c.AutoGenerateCreate(ctx, createTaskOptions)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgKapacitorRuleCreated.String(), task.Rule.Name, org.Name)
	s.logRegistration(ctx, "Kapacitors Task", msg)

	res := newAlertResponse(task, deviceOrg.AIKapacitor.SrcID, deviceOrg.AIKapacitor.KapaID)
	encodeJSON(w, http.StatusOK, res, s.Logger)

}

// GetKapacitorTask proxies Get to kapacitor
func (s *Service) GetKapacitorTask(w http.ResponseWriter, r *http.Request) {

	ctx := r.Context()
	tid := httprouter.GetParamFromContext(ctx, "tid")
	parts := strings.Split(tid, "-")
	if len(parts) < 2 {
		notFound(w, "Invalid tid format", s.Logger)
		return
	}

	orgID := parts[1]

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgID})
	if err != nil {
		notFound(w, err.Error(), s.Logger)
		return
	}

	c := kapa.NewClient(deviceOrg.AIKapacitor.KapaURL, deviceOrg.AIKapacitor.Username, deviceOrg.AIKapacitor.Password, deviceOrg.AIKapacitor.InsecureSkipVerify)
	aiConfig := s.InternalENV.AIConfig
	// Check if the rule exists within scope
	task, err := c.GetAITask(ctx, tid, aiConfig.PredictionRegex)
	if err != nil {
		if err == cloudhub.ErrAlertNotFound {
			notFound(w, deviceOrg.AIKapacitor.KapaID, s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := newAlertResponse(task, deviceOrg.AIKapacitor.SrcID, deviceOrg.AIKapacitor.KapaID)
	encodeJSON(w, http.StatusOK, res, s.Logger)

}

// UpdateKapacitorTask proxies Update to kapacitor
func (s *Service) UpdateKapacitorTask(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req cloudhub.AutoGeneratePredictionRule
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	ctx := r.Context()
	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &id})
	if err != nil {
		notFound(w, err.Error(), s.Logger)
		return
	}
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &id})
	if err != nil {
		notFound(w, err.Error(), s.Logger)
		return
	}
	if deviceOrg.AIKapacitor.KapaURL == "" {
		invalidData(w, fmt.Errorf("Please check the Kapacitor configuration"), s.Logger)
		return
	}

	c := kapa.NewClient(deviceOrg.AIKapacitor.KapaURL, deviceOrg.AIKapacitor.Username, deviceOrg.AIKapacitor.Password, deviceOrg.AIKapacitor.InsecureSkipVerify)

	if req.Name == "" {
		req.Name = req.ID
	}
	if req.OrganizationName == "" {
		req.OrganizationName = org.Name
	}
	if req.TaskTemplate == "" {
		req.TaskTemplate = PredictionTaskField
	}

	alertServices, err := kapa.ParseAlertForTarget(req.AlertRule, nil)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	tmplParams := []cloudhub.TemplateBlock{
		{
			Name: "main", Params: cloudhub.TemplateParamsMap{
				"OrgName":              req.OrganizationName,
				"Message":              req.Message,
				"RetentionPolicy":      RetentionPolicy,
				"PredictMode":          req.PredictMode,
				"PredictModeCondition": req.PredictModeCondition,
				"AlertServices":        alertServices,
				"Group":                "{{.Group}}",
				"Details":              req.Details,
			},
		},
	}
	tm := s.InternalENV.TemplatesManager
	t, err := tm.Get(ctx, string(PredictionTaskField))

	templateService := &TemplateService{}
	script, err := templateService.LoadTemplate(cloudhub.LoadTemplateConfig{
		Field:          PredictionTaskField,
		TemplateString: t.Template,
	}, tmplParams)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	kapaID := cloudhub.PredictScriptPrefix + org.ID
	DBRPs := []client.DBRP{{Database: "Default", RetentionPolicy: RetentionPolicy}}

	if org.ID != "default" {
		DBRPs = append(DBRPs, client.DBRP{Database: org.Name, RetentionPolicy: RetentionPolicy})
	}
	status := client.Enabled
	if req.Status != "" {
		if err := status.UnmarshalText([]byte(req.Status)); err != nil {
			invalidData(w, err, s.Logger)
			return
		}
	}
	createTaskOptions := &client.UpdateTaskOptions{
		ID:         kapaID,
		Type:       client.StreamTask,
		DBRPs:      DBRPs,
		TICKscript: script,
		Status:     status,
	}
	aiConfig := s.InternalENV.AIConfig
	newAITaskProcessor := kapa.NewAITaskProcess{Regex: aiConfig.PredictionRegex}
	task, err := c.AutoGenerateUpdate(ctx, createTaskOptions, c.Href(kapaID), newAITaskProcessor)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	msg := fmt.Sprintf(MsgKapacitorRuleModified.String(), task.Rule.Name, org.Name)
	s.logRegistration(ctx, "Kapacitors Task", msg)

	res := newAlertResponse(task, deviceOrg.AIKapacitor.SrcID, deviceOrg.AIKapacitor.KapaID)
	encodeJSON(w, http.StatusOK, res, s.Logger)

}
