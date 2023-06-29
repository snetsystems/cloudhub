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
	Provider  string `json:"provider"`
	NameSpace string `json:"namespace"`
	AccessKey string `json:"accesskey"`
	SecretKey string `json:"secretkey"`
	Minion    string `json:"minion"`
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
	}

	return nil
}

func (r *cspRequest) validUpdate() error {
	if r.Provider != "" {
		return fmt.Errorf("Provider cannot be changed")
	}

	if r.NameSpace == "" && r.SecretKey == "" && r.AccessKey == "" && r.Minion == "" {
		return fmt.Errorf("No fields to update")
	}

	return nil
}

type cspResponse struct {
	ID           string    `json:"id"`
	Provider     string    `json:"provider"`
	NameSpace    string    `json:"namespace"`
	AccessKey    string    `json:"accesskey"`
	SecretKey    string    `json:"secretkey"`
	Organization string    `json:"organization"`
	Minion       string    `json:"minion"`
	Links        selfLinks `json:"links"`
}

func newCSPResponse(csp *cloudhub.CSP) *cspResponse {
	selfLink := fmt.Sprintf("/cloudhub/v1/csp/%s", csp.ID)

	resData := &cspResponse{
		ID:           csp.ID,
		Provider:     csp.Provider,
		NameSpace:    csp.NameSpace,
		AccessKey:    csp.AccessKey,
		SecretKey:    csp.SecretKey,
		Organization: csp.Organization,
		Minion:       csp.Minion,
		Links:        selfLinks{Self: selfLink},
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

	csp := &cloudhub.CSP{
		Provider:     req.Provider,
		NameSpace:    req.NameSpace,
		AccessKey:    req.AccessKey,
		SecretKey:    req.SecretKey,
		Organization: defaultOrg.ID,
		Minion:       req.Minion,
	}

	// validate that the provider and namespace exists
	if s.existsCSPInOrg(ctx, csp.Provider, csp.NameSpace) {
		invalidData(w, fmt.Errorf("Provider and NameSpace does existed in organization"), s.Logger)
		return
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
		// It does not need to call generateSaltConfigForOSP no longer.
		// statusCode, resp, err := s.generateSaltConfigForOSP(csp)
		// if err != nil {
		// 	unknownErrorWithMessage(w, err, s.Logger)
		// 	return
		// } else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		// 	Error(w, statusCode, string(resp), s.Logger)
		// 	return
		// }

		statusCode, resp, err := s.generateTelegrafConfigForOSP(ctx, csp)
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

	// If the provider is osp, remove firstly the salt and telegraf config.
	switch csp.Provider {
	case cloudhub.OSP:
		statusCode, resp, err := s.removeSaltConfigForOSP(csp)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			return
		}

		statusCode, resp, err = s.removeTelegrafConfigForOSP(csp)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			return
		}
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

	switch req.Provider {
	case cloudhub.OSP:
		Error(w, http.StatusForbidden, "If the provider is OSP, this API does not support to update anything.", s.Logger)
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

// Deprecated: It does not need to call generateSaltConfigForOSP no longer.
func (s *Service) generateSaltConfigForOSP(csp *cloudhub.CSP) (int, []byte, error) {
	fileName := fmt.Sprintf("osp_%s.conf", csp.NameSpace)
	saltConfigPath := path.Join(s.AddonURLs["salt-env-path"], "etc/salt/cloud.providers.d", fileName)
	authURLforSalt := strings.TrimRight(s.OSP.AuthURL, "/") + "/v3"
	textYaml := fmt.Sprintf("%s:\n  driver: openstack\n  region_name: RegionOne\n  auth:\n    username: '%s'\n    password: '%s'\n    project_name: '%s'\n    user_domain_name: %s\n    project_domain_name: %s\n    auth_url: '%s'", csp.NameSpace, s.OSP.AdminUser, s.OSP.AdminPW, csp.NameSpace, s.OSP.UserDomain, s.OSP.ProjectDomain, authURLforSalt)

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
	InsecureSkipVerify     bool     `toml:"insecure_skip_verify"`
	Tags                   tags     `toml:"tags"`
}
type inputs struct {
	Openstack []openstack `toml:"openstack"`
}

func (s *Service) generateTelegrafConfigForOSP(ctx context.Context, csp *cloudhub.CSP) (int, []byte, error) {
	fileName := fmt.Sprintf("%s.conf", csp.NameSpace)
	dirPath := "/etc/telegraf/telegraf.d/tenant/osp"
	filePath := path.Join(dirPath, fileName)
	var statusCode int
	var resp []byte
	var err error

	useLocalModule, err := s.IsMinionActive("osp")

	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	if useLocalModule {
		if statusCode, resp, err := s.DirectoryExistsWithLocalClient(dirPath, s.AddonTokens["osp"]); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			return statusCode, nil, err
		} else if resp != nil {
			r := &struct {
				Return []map[string]bool `json:"return"`
			}{}

			if err := json.Unmarshal(resp, r); err != nil {
				return http.StatusInternalServerError, nil, err
			}

			if !r.Return[0][s.AddonTokens["osp"]] {
				if statusCode, _, err := s.MkdirWithLocalClient(dirPath, s.AddonTokens["osp"]); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
					return statusCode, nil, err
				}
			}
		} else {
			return http.StatusInternalServerError, nil, fmt.Errorf("Unknown error ocuured at DirectoryExists() func")
		}

	} else {
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

	var influxdbs []influxdb
	for _, url := range outputURLs {
		influxdbs = append(influxdbs, influxdb{
			Urls:     []string{url},
			Database: csp.NameSpace,
			Tagpass: tagpass{
				Tenant: []string{csp.NameSpace},
			},
		})
	}

	telegrafConfig := &telegrafConfig{
		Outputs: outputs{
			Influxdb: influxdbs,
		},
		Inputs: inputs{
			Openstack: []openstack{
				{
					Interval:               "2m",
					AuthenticationEndpoint: s.OSP.AuthURL,
					EnabledServices:        []string{"projects", "servers", "flavors", "networks", "ports", "storage_pools", "subnets", "volumes", "compute_quotas", "network_quotas", "volume_quotas"},
					Domain:                 s.OSP.UserDomain,
					Project:                csp.NameSpace,
					Username:               s.OSP.AdminUser,
					Password:               s.OSP.AdminPW,
					ServerDiagnotics:       true,
					InsecureSkipVerify:     true,
					Tags: tags{
						Tenant: csp.NameSpace,
					},
				},
			},
		},
	}
	b, _ := toml.Marshal(telegrafConfig)

	if useLocalModule && err == nil {
		statusCode, resp, err = s.CreateFileWithLocalClient(filePath, []string{string(b)}, s.AddonTokens["osp"])
	} else {
		statusCode, resp, err = s.CreateFile(filePath, []string{string(b)})
	}

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
	useLocalModule, err := s.IsMinionActive("osp")
	var statusCode int
	var resp []byte

	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	if useLocalModule {
		statusCode, resp, err = s.RemoveFileWithLocalClient(filePath, s.AddonTokens["osp"])
	} else {
		statusCode, resp, err = s.RemoveFile(filePath)
	}

	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}

	return s.DaemonReload("telegraf.service")
}

func (s *Service) IsMinionActive(provider string) (bool, error) {

	useLocalModule := false

	if _, ok := s.AddonTokens[provider]; ok {
		useLocalModule = true
		if statusCode, resp, err := s.IsActiveMinionPingTest(s.AddonTokens[provider]); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			return useLocalModule, err
		} else if resp != nil {

			r := &struct {
				Return []map[string]bool `json:"return"`
			}{}

			if err := json.Unmarshal(resp, r); err != nil || !r.Return[0][s.AddonTokens[provider]] {

				return useLocalModule, fmt.Errorf("Target minion %s is not available.", s.AddonTokens[provider])
			}
		}
		return useLocalModule, nil
	} else {
		return useLocalModule, nil
	}

}

type Response struct {
	Return []ReturnData `json:"return"`
}

type ReturnData struct {
	Tag  string                 `json:"tag"`
	Data ReturnWheelKeyListData `json:"data"`
}

type ReturnWheelKeyListData struct {
	Fun        string         `json:"fun"`
	JID        string         `json:"jid"`
	Tag        string         `json:"tag"`
	User       string         `json:"user"`
	Stamp      string         `json:"_stamp"`
	MinionData MinionResponse `json:"return"`
	Success    bool           `json:"success"`
}

type MinionResponse struct {
	Minions         []string `json:"minions"`
	MinionsPre      []string `json:"minions_pre"`
	MinionsRejected []string `json:"minions_rejected"`
	MinionsDenied   []string `json:"minions_denied"`
	Local           []string `json:"local"`
}

func (s *Service) IsMinionAvailable(provider string) (bool, error) {

	IsMinionAvailable := false

	if targetMinion, ok := s.AddonTokens[provider]; ok {

		if statusCode, resp, err := s.GetWheelKeyListAll(); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			return IsMinionAvailable, fmt.Errorf("Target minion %s is not available.", targetMinion)
		} else {
			var response Response
			if err := json.Unmarshal([]byte(resp), &response); err != nil {
				fmt.Println("JSON 파싱 오류:", err)
				return IsMinionAvailable, err
			}

			minionData := response.Return[0].Data.MinionData
			for _, minions := range [][]string{minionData.Minions, minionData.MinionsPre, minionData.MinionsRejected, minionData.MinionsDenied} {
				for _, minion := range minions {
					if minion == targetMinion {
						IsMinionAvailable = true
						return IsMinionAvailable, nil
					}
				}
			}
		}
		return IsMinionAvailable, fmt.Errorf("Target minion %s is not available.", targetMinion)
	} else {
		return IsMinionAvailable, nil
	}

}
