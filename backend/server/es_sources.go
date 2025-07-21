package server

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/elastic"
)

type esSourceLinks struct {
	Self        string `json:"self"`        // /sources/{id}
	Search      string `json:"search"`      // /sources/{id}/search
	Indices     string `json:"indices"`     // /sources/{id}/indices
	Bulk        string `json:"bulk"`        // /sources/{id}/bulk
	Permissions string `json:"permissions"` // /sources/{id}/permissions
	Users       string `json:"users"`       // /sources/{id}/users
	Roles       string `json:"roles"`       // /sources/{id}/roles  (if role-capable)
	Health      string `json:"health"`      // /sources/{id}/health
	Proxy       string `json:"proxy"`       // /es/{id}/proxy/<path>
}

type esSourceResponse struct {
	cloudhub.EsSource
	AuthenticationMethod string        `json:"authentication"`
	Links                esSourceLinks `json:"links"`
}

func esSourceAuthenticationMethod(src cloudhub.EsSource) string {
	switch {
	case src.Authentication == cloudhub.APIkeyMethod:
		return cloudhub.APIkeyMethod
	case src.Authentication == cloudhub.BasicMethod:
		return cloudhub.BasicMethod
	default:
		return "unknown"
	}
}

func newEsSourceResponse(src cloudhub.EsSource) esSourceResponse {
	if src.BasicAuth != nil {
		src.BasicAuth.Password = ""
	}

	if src.APIKeyAuth != nil {
		src.APIKeyAuth.APIKey = ""
		src.APIKeyAuth.ID = ""
	}

	base := "/cloudhub/v1/es"
	idPath := fmt.Sprintf("%s/%d", base, src.ID)

	links := esSourceLinks{
		Self:   idPath,
		Health: idPath + "/health",
		Proxy:  idPath + "/proxy",
	}

	return esSourceResponse{
		EsSource:             src,
		AuthenticationMethod: esSourceAuthenticationMethod(src),
		Links:                links,
	}
}

// NewEsSource adds a new valid Elasticsearch source to the store
func (s *Service) NewEsSource(w http.ResponseWriter, r *http.Request) {
	var src cloudhub.EsSource
	if err := json.NewDecoder(r.Body).Decode(&src); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	ctx := r.Context()

	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	if err := validEsSourceRequest(&src, defaultOrg.ID); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	src.Version = s.fetchEsVersion(ctx, &src)

	if err := s.validateEsCredentials(ctx, &src); err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	var saved cloudhub.EsSource
	if saved, err = s.Store.EsSources(ctx).Add(ctx, src); err != nil {
		msg := fmt.Errorf("Error storing source %v: %v", src, err)
		unknownErrorWithMessage(w, msg, s.Logger)
		return
	}

	src = saved
	s.logRegistration(ctx, "EsSources", fmt.Sprintf(MsgEsSourcesCreated.String(), src.Name))

	res := newEsSourceResponse(src)
	location(w, res.Links.Self)
	encodeJSON(w, http.StatusCreated, res, s.Logger)
}

// EsSources returns all Elasticsearch sources from the store.
func (s *Service) EsSources(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	res := getEsSourcesResponse{
		EsSources: make([]esSourceResponse, 0),
	}

	srcs, err := s.Store.EsSources(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, "Error loading ES sources", s.Logger)
		return
	}

	sourceCh := make(chan esSourceResponse, len(srcs))

	for _, src := range srcs {
		go func(src cloudhub.EsSource) {
			src.Version = s.fetchEsVersion(ctx, &src)
			sourceCh <- newEsSourceResponse(src)
		}(src)
	}

	for i := 0; i < len(srcs); i++ {
		res.EsSources = append(res.EsSources, <-sourceCh)
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// EsSourcesID retrieves a source from the store
func (s *Service) EsSourcesID(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	ctx := r.Context()

	src, err := s.Store.EsSources(ctx).Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	src.Version = s.fetchEsVersion(ctx, &src)

	encodeJSON(w, http.StatusOK, newEsSourceResponse(src), s.Logger)
}

// UpdateEsSource handles incremental updates of an existing Elasticsearch source
func (s *Service) UpdateEsSource(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	src, err := s.Store.EsSources(ctx).Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	var req cloudhub.EsSource
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if req.Name != "" {
		src.Name = req.Name
	}
	if req.URL != "" {
		src.URL = req.URL
	}
	if req.BasicAuth != nil {
		if req.BasicAuth.Password != "" || src.BasicAuth == nil {
			src.BasicAuth = req.BasicAuth
		}
	}
	if req.APIKeyAuth != nil {
		if (req.APIKeyAuth.APIKey != "" && req.APIKeyAuth.ID != "") || src.APIKeyAuth == nil {
			src.APIKeyAuth = req.APIKeyAuth
		}
	}

	src.InsecureSkipVerify = req.InsecureSkipVerify

	if len(req.IndexPatterns) > 0 {
		src.IndexPatterns = req.IndexPatterns
	}
	if req.DefaultIndex != "" {
		src.DefaultIndex = req.DefaultIndex
	}

	if req.Organization != "" {
		src.Organization = req.Organization
	}
	if req.Authentication != "" {
		src.Authentication = req.Authentication
	}

	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}
	if err := validEsSourceRequest(&src, defaultOrg.ID); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	src.Version = s.fetchEsVersion(ctx, &src)

	if err := s.validateEsCredentials(ctx, &src); err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	if _, dryRun := r.URL.Query()["dryRun"]; !dryRun {
		if err := s.Store.EsSources(ctx).Update(ctx, src); err != nil {
			msg := fmt.Sprintf("Error updating ES source ID %d: %v", id, err)
			Error(w, http.StatusInternalServerError, msg, s.Logger)
			return
		}
	}

	msg := fmt.Sprintf(MsgEsSourcesModified.String(), src.Name)
	s.logRegistration(ctx, "EsSources", msg)

	res := newEsSourceResponse(src)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// RemoveEsSource deletes the source from the store
func (s *Service) RemoveEsSource(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	ctx := r.Context()

	src, err := s.Store.EsSources(ctx).Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	if err := s.Store.EsSources(ctx).Delete(ctx, src); err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	s.logRegistration(ctx, "EsSources", fmt.Sprintf(MsgEsSourcesDeleted.String(), src.Name))
	w.WriteHeader(http.StatusNoContent)
}

// EsSourceHealth determines if the ElasticSearch is running
func (s *Service) EsSourceHealth(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	ctx := r.Context()

	src, err := s.Store.EsSources(ctx).Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if err := s.validateEsCredentials(ctx, &src); err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validEsSourceRequest(s *cloudhub.EsSource, defaultOrgID string) error {
	if s == nil {
		return fmt.Errorf("source must be non‑nil")
	}
	if s.URL == "" {
		return fmt.Errorf("url required")
	}
	if _, err := url.ParseRequestURI(s.URL); err != nil {
		return fmt.Errorf("invalid URL: %v", err)
	}

	if s.Organization == "" {
		s.Organization = defaultOrgID
	}

	return nil
}

func (s *Service) fetchEsVersion(ctx context.Context, src *cloudhub.EsSource) string {
	cli, err := elastic.NewClient(elastic.Config{
		URL:                src.URL,
		BasicAuth:          src.BasicAuth,
		APIKeyAuth:         src.APIKeyAuth,
		Authentication:     src.Authentication,
		InsecureSkipVerify: src.InsecureSkipVerify,
	})
	if err != nil {
		s.Logger.WithField("err", err).Info("Failed to get ES version")
		return "unknown"
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	version, err := cli.Version(ctx)
	if err != nil {
		s.Logger.WithField("err", err).Info("Failed to get ES version")
		if strings.HasPrefix(src.Version, "7.") || strings.HasPrefix(src.Version, "8.") {
			return src.Version
		}
		return "unknown"
	}
	return version
}

func (s *Service) validateEsCredentials(ctx context.Context, src *cloudhub.EsSource) error {
	cli, err := elastic.NewClient(elastic.Config{
		URL:                src.URL,
		BasicAuth:          src.BasicAuth,
		APIKeyAuth:         src.APIKeyAuth,
		Authentication:     src.Authentication,
		InsecureSkipVerify: src.InsecureSkipVerify,
	})
	if err != nil {
		return fmt.Errorf("failed to create ES client: %w", err)
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := cli.Ping(ctx); err != nil {
		return fmt.Errorf("ES ping failed: %w", err)
	}
	return nil
}

type getEsSourcesResponse struct {
	EsSources []esSourceResponse `json:"esSources"`
}

// Elastic proxies any request under
//
//	/cloudhub/v1/es/{id}/proxy/{wildcard…}
func (s *Service) Elastic(w http.ResponseWriter, r *http.Request) {
	id, err := paramID("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	parts := strings.SplitN(r.URL.Path, "/proxy", 2)
	var tail string
	if len(parts) == 2 {
		tail = parts[1] // starts with "/" or may be empty
	}
	if tail == "" {
		tail = "/" // default to Elasticsearch root
	}

	ctx := r.Context()
	src, err := s.Store.EsSources(ctx).Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	proxy := buildEsReverseProxy(src)
	proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, e error) {
		s.Logger.WithField("err", e)
		rw.WriteHeader(http.StatusBadGateway)
	}

	r.URL.Scheme = "" // overwritten by Director
	r.URL.Host = ""
	r.URL.Path = tail  // "/_cluster/health" …
	r.URL.RawPath = "" // let proxy re‑encode
	r.Host = ""        // Host header will be set by proxy

	proxy.ServeHTTP(w, r)
}

// buildEsReverseProxy creates a reverse proxy with per‑source TLS + auth
func buildEsReverseProxy(src cloudhub.EsSource) *httputil.ReverseProxy {
	target, _ := url.Parse(src.URL) // src.URL already validated
	rp := httputil.NewSingleHostReverseProxy(target)

	rp.Transport = elastic.SharedTransport(src.InsecureSkipVerify)

	rp.Director = func(req *http.Request) {
		// Preserve original method/URL from incoming ServeHTTP call
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		// Inject authentication header
		if src.BasicAuth != nil {
			req.SetBasicAuth(src.BasicAuth.Username, src.BasicAuth.Password)
		} else if src.APIKeyAuth != nil {
			// RFC‑9308:  Authorization: ApiKey <base64(id:apiKey)>
			token := base64.StdEncoding.EncodeToString(
				[]byte(src.APIKeyAuth.ID + ":" + src.APIKeyAuth.APIKey),
			)
			req.Header.Set("Authorization", "ApiKey "+token)
		}
	}
	return rp
}

// MultiElasticProxy handles concurrent proxy of a single Elasticsearch API call to multiple sources and aggregates the results.
func (s *Service) MultiElasticProxy(w http.ResponseWriter, r *http.Request) {
	const MaxWorkers = cloudhub.WorkerLimit

	var req cloudhub.MultiProxyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	results := make([]cloudhub.MultiProxyResult, len(req.SourceIds))

	var wg sync.WaitGroup
	sem := make(chan struct{}, MaxWorkers)

	for i, srcID := range req.SourceIds {

		wg.Add(1)
		go func(idx int, id string) {

			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := cloudhub.MultiProxyResult{SourceID: id}
			sID, err := strconv.Atoi(id)
			if err != nil {
				result.Status = 404
				result.Error = "ES Source not found"
				results[idx] = result
				return
			}

			src, err := s.Store.EsSources(ctx).Get(ctx, sID)
			if err != nil {
				result.Status = 404
				result.Error = "ES Source not found"
				results[idx] = result
				return
			}

			esPath := req.Path
			if len(req.Query) > 0 {
				q := url.Values{}
				for k, v := range req.Query {
					q.Set(k, v)
				}
				esPath += "?" + q.Encode()
			}

			resp, err := s.doElasticsearchRequest(src, req.Method, esPath, req.Body)
			if err != nil {
				result.Status = 500
				result.Error = err.Error()
				results[idx] = result
				return
			}

			defer resp.Body.Close()

			result.Status = resp.StatusCode
			respBody, _ := io.ReadAll(resp.Body)
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				var data interface{}
				if err := json.Unmarshal(respBody, &data); err == nil {
					result.Data = data
				} else {
					result.Data = string(respBody)
				}
			} else {
				result.Error = string(respBody)
			}
			results[idx] = result
		}(i, srcID)
	}

	wg.Wait()
	encodeJSON(w, http.StatusOK, results, s.Logger)
}

func (s *Service) doElasticsearchRequest(
	src cloudhub.EsSource,
	method, path string,
	body interface{},
) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(b)
	}

	esURL := src.URL + path
	req, err := http.NewRequest(method, esURL, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	if src.BasicAuth != nil {
		req.SetBasicAuth(src.BasicAuth.Username, src.BasicAuth.Password)
	} else if src.APIKeyAuth != nil {
		token := base64.StdEncoding.EncodeToString([]byte(src.APIKeyAuth.ID + ":" + src.APIKeyAuth.APIKey))
		req.Header.Set("Authorization", "ApiKey "+token)
	}

	client := &http.Client{
		Transport: elastic.SharedTransport(src.InsecureSkipVerify),
		Timeout:   5 * time.Second,
	}
	return client.Do(req)
}

// DistinctHostsBefore returns a set of hostnames that have at least one
// document in `indexPattern` older than N days.
func (s *Service) DistinctHostsBefore(
	ctx context.Context, srcID int, indexPattern string, days int,
) (map[string]cloudhub.ESInfo, error) {

	src, err := s.Store.EsSources(ctx).Get(ctx, srcID)
	if err != nil {
		return nil, err
	}

	cli, err := elastic.NewClient(elastic.Config{
		URL:                src.URL,
		BasicAuth:          src.BasicAuth,
		APIKeyAuth:         src.APIKeyAuth,
		Authentication:     src.Authentication,
		InsecureSkipVerify: src.InsecureSkipVerify,
	})
	if err != nil {
		return nil, err
	}

	return cli.DistinctHostsBefore(ctx, indexPattern, days)
}

// GetLatestHostInfo returns the latest ESInfo for a hostname.
func (s *Service) GetLatestHostInfo(
	ctx context.Context, srcID int, indexPattern, hostname string,
) (cloudhub.ESInfo, bool, error) {

	src, err := s.Store.EsSources(ctx).Get(ctx, srcID)
	if err != nil {
		return cloudhub.ESInfo{}, false, err
	}

	cli, err := elastic.NewClient(elastic.Config{
		URL:                src.URL,
		BasicAuth:          src.BasicAuth,
		APIKeyAuth:         src.APIKeyAuth,
		Authentication:     src.Authentication,
		InsecureSkipVerify: src.InsecureSkipVerify,
	})
	if err != nil {
		return cloudhub.ESInfo{}, false, err
	}

	return cli.GetLatestHostInfo(ctx, indexPattern, hostname)
}
