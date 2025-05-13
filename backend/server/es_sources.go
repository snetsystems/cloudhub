package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
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
}

type esSourceResponse struct {
	cloudhub.EsSource
	AuthenticationMethod string        `json:"authentication"`
	Links                esSourceLinks `json:"links"`
}

func esSourceAuthenticationMethod(src cloudhub.EsSource) string {
	switch {
	case src.BasicAuth != nil:
		return "basic"
	case src.APIKeyAuth != nil:
		return "apiKey"
	default:
		return "unknown"
	}
}

func newEsSourceResponse(src cloudhub.EsSource) esSourceResponse {
	src.BasicAuth.Password = ""
	src.BasicAuth.Username = ""
	base := "/cloudhub/v1/es"
	idPath := fmt.Sprintf("%s/%d", base, src.ID)

	links := esSourceLinks{
		Self:        idPath,
		Search:      idPath + "/search",
		Indices:     idPath + "/indices",
		Bulk:        idPath + "/bulk",
		Permissions: idPath + "/permissions",
		Users:       idPath + "/users",
		Health:      idPath + "/health",
	}

	return esSourceResponse{
		EsSource:             src,
		AuthenticationMethod: esSourceAuthenticationMethod(src),
		Links:                links,
	}
}

// NewEsSource ...
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

	if src, err := s.Store.EsSources(ctx).Add(ctx, src); err != nil {
		msg := fmt.Errorf("Error storing source %v: %v", src, err)
		unknownErrorWithMessage(w, msg, s.Logger)
		return
	}

	s.logRegistration(ctx, "EsSources", fmt.Sprintf(MsgSourcesCreated.String(), src.Name))

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

	s.logRegistration(ctx, "EsSources", fmt.Sprintf(MsgSourcesDeleted.String(), src.Name))
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
