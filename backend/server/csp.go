package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"strings"

	"github.com/pelletier/go-toml/v2"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type cspRequest struct {
	Provider      string `json:"provider"`
	NameSpace     string `json:"namespace"`
	AccessKey     string `json:"accesskey"`
	SecretKey     string `json:"secretkey"`
	AuthURL       string `json:"authurl"`
	ProjectDomain string `json:"projectdomain"`
	UserDomain    string `json:"userdomain"`
	Minion        string `json:"minion"`
}

func (r *cspRequest) validCreate() error {
	switch {
	case r.Provider == "":
		return fmt.Errorf("provider required CSP request body")
	case r.NameSpace == "":
		return fmt.Errorf("namespace required CSP request body")
	}

	switch r.Provider {
	case cloudhub.AWS:
		switch {
		case r.AccessKey == "":
			return fmt.Errorf("accesskey required CSP request body")
		case r.SecretKey == "":
			return fmt.Errorf("secretkey required CSP request body")
		}
	case cloudhub.OSP:
		switch {
		case r.AccessKey == "":
			return fmt.Errorf("accesskey required CSP request body")
		case r.SecretKey == "":
			return fmt.Errorf("secretkey required CSP request body")
		case r.AuthURL == "":
			return fmt.Errorf("authurl required CSP request body")
		case r.ProjectDomain == "":
			return fmt.Errorf("projectdomain required CSP request body")
		case r.UserDomain == "":
			return fmt.Errorf("userdomain required CSP request body")
		}
	}

	return nil
}

func (r *cspRequest) validUpdate() error {
	if r.Provider != "" {
		return fmt.Errorf("Provider cannot be changed")
	}

	if r.NameSpace == "" && r.SecretKey == "" && r.AccessKey == "" && r.AuthURL == "" && r.ProjectDomain == "" && r.UserDomain == "" && r.Minion == "" {
		return fmt.Errorf("No fields to update")
	}

	return nil
}

type cspResponse struct {
	ID            string    `json:"id"`
	Provider      string    `json:"provider"`
	NameSpace     string    `json:"namespace"`
	AccessKey     string    `json:"accesskey"`
	SecretKey     string    `json:"secretkey"`
	AuthURL       string    `json:"authurl"`
	ProjectDomain string    `json:"projectdomain"`
	UserDomain    string    `json:"userdomain"`
	Organization  string    `json:"organization"`
	Minion        string    `json:"minion"`
	Links         selfLinks `json:"links"`
}

func newCSPResponse(csp *cloudhub.CSP) *cspResponse {
	selfLink := fmt.Sprintf("/cloudhub/v1/csp/%s", csp.ID)

	resData := &cspResponse{
		ID:            csp.ID,
		Provider:      csp.Provider,
		NameSpace:     csp.NameSpace,
		AccessKey:     csp.AccessKey,
		SecretKey:     csp.SecretKey,
		AuthURL:       csp.AuthURL,
		ProjectDomain: csp.ProjectDomain,
		UserDomain:    csp.UserDomain,
		Organization:  csp.Organization,
		Minion:        csp.Minion,
		Links:         selfLinks{Self: selfLink},
	}

	return resData
}

type cspsResponse struct {
	Links selfLinks      `json:"links"`
	CSPs  []*cspResponse `json:"CSPs"`
}

func newCSPsResponse(csps []cloudhub.CSP) *cspsResponse {
	cspsResp := make([]*cspResponse, len(csps))
	for i, csp := range csps {
		cspsResp[i] = newCSPResponse(&csp)
	}

	selfLink := "/cloudhub/v1/csp"

	return &cspsResponse{
		CSPs: cspsResp,
		Links: selfLinks{
			Self: selfLink,
		},
	}
}

// CSP returns all CSP within the store
func (s *Service) CSP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	csps, err := s.Store.CSP(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := newCSPsResponse(csps)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// CSPID returns a single specified CSP
func (s *Service) CSPID(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	csp, err := s.Store.CSP(ctx).Get(ctx, cloudhub.CSPQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	res := newCSPResponse(csp)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewCSP creates and returns a new CSP object
func (s *Service) NewCSP(w http.ResponseWriter, r *http.Request) {
	var req cspRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.validCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	var projectdomain string
	var userdomain string
	if req.Provider == cloudhub.OSP {
		if req.ProjectDomain == "" {
			projectdomain = "default"
		} else {
			projectdomain = req.ProjectDomain
		}
		if req.UserDomain == "" {
			userdomain = "default"
		} else {
			userdomain = req.UserDomain
		}
	}

	csp := &cloudhub.CSP{
		Provider:      req.Provider,
		NameSpace:     req.NameSpace,
		AccessKey:     req.AccessKey,
		SecretKey:     req.SecretKey,
		AuthURL:       req.AuthURL,
		ProjectDomain: projectdomain,
		UserDomain:    userdomain,
		Organization:  defaultOrg.ID,
		Minion:        req.Minion,
	}

	// validate that the provider and namespace exists
	if s.existsCSPInOrg(ctx, csp.Provider, csp.NameSpace) {
		invalidData(w, fmt.Errorf("Provider and NameSpace does existed in organization"), s.Logger)
		return
	}

	// If the provider is osp, create the project to osp.
	switch csp.Provider {
	case cloudhub.OSP:
		statusCode, resp, err := s.createOSPProject(csp)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			return
		}
	}

	// Add CSP
	res, err := s.Store.CSP(ctx).Add(ctx, csp)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// If the provider is osp, generate the salt and telegraf config.
	switch csp.Provider {
	case cloudhub.OSP:
		statusCode, resp, err := s.generateSaltConfigForOSP(csp)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			return
		}

		statusCode, resp, err = s.generateTelegrafConfigForOSP(ctx, csp)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			return
		}
	}

	// log registrationte
	msg := fmt.Sprintf(MsgCSPCreated.String(), res.Provider)
	s.logRegistration(ctx, "CSP", msg)

	resCSP := newCSPResponse(res)
	location(w, resCSP.Links.Self)
	encodeJSON(w, http.StatusCreated, resCSP, s.Logger)
}

// RemoveCSP deletes a CSP
func (s *Service) RemoveCSP(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	csp, err := s.Store.CSP(ctx).Get(ctx, cloudhub.CSPQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if err := s.Store.CSP(ctx).Delete(ctx, csp); err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgCSPDeleted.String(), csp.Provider)
	s.logRegistration(ctx, "CSP", msg)

	w.WriteHeader(http.StatusNoContent)
}

// UpdateCSP completely updates either the CSP
func (s *Service) UpdateCSP(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req cspRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.validUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	oriCSP, err := s.Store.CSP(ctx).Get(ctx, cloudhub.CSPQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if req.NameSpace != "" {
		oriCSP.NameSpace = req.NameSpace
	}
	if req.AccessKey != "" {
		oriCSP.AccessKey = req.AccessKey
	}
	if req.SecretKey != "" {
		oriCSP.SecretKey = req.SecretKey
	}
	if req.AuthURL != "" {
		oriCSP.AuthURL = req.AuthURL
	}
	if req.ProjectDomain != "" {
		oriCSP.ProjectDomain = req.ProjectDomain
	}
	if req.UserDomain != "" {
		oriCSP.UserDomain = req.UserDomain
	}
	if req.Minion != "" {
		oriCSP.Minion = req.Minion
	}

	if err := s.Store.CSP(ctx).Update(ctx, oriCSP); err != nil {
		msg := fmt.Sprintf("Error updating CSP ID %s: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgCSPModified.String(), oriCSP.Provider)
	s.logRegistration(ctx, "CSP", msg)

	res := newCSPResponse(oriCSP)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// exists CSP and NameSpace in organization
func (s *Service) existsCSPInOrg(ctx context.Context, provider string, namespace string) bool {
	csps, err := s.Store.CSP(ctx).All(ctx)
	if err != nil {
		return true
	}

	for _, csp := range csps {
		if csp.Provider == provider && csp.NameSpace == namespace {
			return true
		}
	}

	return false
}

func (s *Service) createOSPProject(csp *cloudhub.CSP) (int, []byte, error) {
	type kwarg struct {
		Project string `json:"project"`
	}
	type param struct {
		Token    string `json:"token"`
		Eauth    string `json:"eauth"`
		Client   string `json:"client"`
		Fun      string `json:"fun"`
		Func     string `json:"func"`
		Provider string `json:"provider"`
		Kwarg    kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:    s.AddonTokens["salt"],
		Eauth:    "pam",
		Client:   "runner",
		Fun:      "cloud.action",
		Func:     "get_compute_limits",
		Provider: csp.Provider,
		Kwarg: kwarg{
			Project: csp.NameSpace,
		},
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

func (s *Service) generateSaltConfigForOSP(csp *cloudhub.CSP) (int, []byte, error) {
	fileName := fmt.Sprintf("osp_%s.conf", csp.NameSpace)
	saltConfigPath := path.Join(s.AddonURLs["salt-env-path"], "etc/salt/cloud.providers.d", fileName)
	authURLforSalt := strings.TrimRight(csp.AuthURL, "/") + "/v3"
	textYaml := fmt.Sprintf("%s:\n  driver: openstack\n  region_name: RegionOne\n  auth:\n    username: '%s'\n    password: '%s'\n    project_name: '%s'\n    user_domain_name: %s\n    project_domain_name: %s\n    auth_url: '%s'", csp.NameSpace, csp.AccessKey, csp.SecretKey, csp.NameSpace, csp.UserDomain, csp.ProjectDomain, authURLforSalt)

	return s.CreateFile(saltConfigPath, []string{textYaml})
}

func (s *Service) removeSaltConfigForOSP(csp *cloudhub.CSP) (int, []byte, error) {
	fileName := fmt.Sprintf("osp_%s.conf", csp.NameSpace)
	path := path.Join(s.AddonURLs["salt-env-path"], "etc/salt/cloud.providers.d", fileName)

	return s.RemoveFile(path)
}

type telegrafConfig struct {
	Outputs outputs `toml:"outputs"`
	Inputs  inputs  `toml:"inputs"`
}
type tagpass struct {
	Tenant []string `toml:"tenant"`
}
type influxdb struct {
	Urls     []string `toml:"urls"`
	Database string   `toml:"database"`
	Tagpass  tagpass  `toml:"tagpass"`
}
type outputs struct {
	Influxdb []influxdb `toml:"influxdb"`
}
type tags struct {
	Tenant string `toml:"tenant"`
}
type openstack struct {
	Interval               string   `toml:"interval"`
	AuthenticationEndpoint string   `toml:"authentication_endpoint"`
	EnabledServices        []string `toml:"enabled_services"`
	Domain                 string   `toml:"domain"`
	Project                string   `toml:"project"`
	Username               string   `toml:"username"`
	Password               string   `toml:"password"`
	ServerDiagnotics       bool     `toml:"server_diagnotics"`
	Tags                   tags     `toml:"tags"`
}
type inputs struct {
	Openstack []openstack `toml:"openstack"`
}

func (s *Service) generateTelegrafConfigForOSP(ctx context.Context, csp *cloudhub.CSP) (int, []byte, error) {
	fileName := fmt.Sprintf("%s.conf", csp.NameSpace)
	dirPath := "/etc/telegraf/telegraf.d/tenant/osp"
	filePath := path.Join(dirPath, fileName)

	if statusCode, resp, err := s.DirectoryExists(dirPath); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, nil, err
	} else if resp != nil {
		r := &struct {
			Return []bool `json:"return"`
		}{}
		if err := json.Unmarshal(resp, r); err != nil {
			return http.StatusInternalServerError, nil, err
		}

		if !r.Return[0] {
			if statusCode, _, err := s.Mkdir(dirPath); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				return statusCode, nil, err
			}
		}
	} else {
		return http.StatusInternalServerError, nil, fmt.Errorf("Unknown error ocuured at DirectoryExists() func")
	}

	serverCtx := serverContext(ctx)
	var outputURLs []string
	i := 0
	for {
		// Retrieve influxdb-urls only of the server option.
		source, err := s.Store.Sources(serverCtx).Get(serverCtx, i)
		if err != nil { // if the source type is not influxdb-url, err is not nil
			break
		}
		outputURLs = append(outputURLs, source.URL)
		i++
	}

	if outputURLs == nil {
		return http.StatusInternalServerError, nil, fmt.Errorf("Output plugin(something like influxdb) urls for telegraf are empty or invalid")
	}

	textToml := &telegrafConfig{
		Outputs: outputs{
			Influxdb: []influxdb{
				{
					Urls:     outputURLs,
					Database: csp.NameSpace,
					Tagpass: tagpass{
						Tenant: []string{csp.NameSpace},
					},
				},
			},
		},
		Inputs: inputs{
			Openstack: []openstack{
				{
					Interval:               "2m",
					AuthenticationEndpoint: csp.AuthURL,
					EnabledServices:        []string{""},
					Domain:                 csp.UserDomain,
					Project:                csp.NameSpace,
					Username:               csp.AccessKey,
					Password:               csp.SecretKey,
					ServerDiagnotics:       true,
					Tags: tags{
						Tenant: csp.NameSpace,
					},
				},
			},
		},
	}
	b, _ := toml.Marshal(textToml)
	statusCode, resp, err := s.CreateFile(filePath, []string{string(b)})
	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}

	return s.DaemonReload("telegraf.service")
}

func (s *Service) removeTelegrafConfigForOSP(csp *cloudhub.CSP) (int, []byte, error) {
	fileName := fmt.Sprintf("%s.conf", csp.NameSpace)
	dirPath := "/etc/telegraf/telegraf.d/tenant/osp"
	filePath := path.Join(dirPath, fileName)

	statusCode, resp, err := s.RemoveFile(filePath)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}

	return s.DaemonReload("telegraf.service")
}
