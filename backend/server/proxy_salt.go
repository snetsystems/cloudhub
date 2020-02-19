package server

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

// SaltProxy proxies requests to services using the path query parameter.
func (s *Service) SaltProxy(w http.ResponseWriter, r *http.Request) {
	var uri string

	path := r.URL.Query().Get("path")
	uri = singleJoiningSlash(s.AddonURLs["salt"], path)
	u, err := url.Parse(uri)
	if err != nil {
		msg := fmt.Sprintf("Error parsing salt url: %v", err)
		Error(w, http.StatusUnprocessableEntity, msg, s.Logger)
		return
	}

	director := func(req *http.Request) {
		req.Host = u.Host
		req.URL = u
	}

	// Without a FlushInterval the HTTP Chunked response for salt logs is
	// buffered and flushed every 30 seconds.
	proxy := &httputil.ReverseProxy{
		Director:      director,
		FlushInterval: time.Second,
	}

	proxy.ServeHTTP(w, r)
}

// SaltProxyPost proxies POST to service
func (s *Service) SaltProxyPost(w http.ResponseWriter, r *http.Request) {
	s.SaltProxy(w, r)
}

// SaltProxyPatch proxies PATCH to Service
func (s *Service) SaltProxyPatch(w http.ResponseWriter, r *http.Request) {
	s.SaltProxy(w, r)
}

// SaltProxyGet proxies GET to service
func (s *Service) SaltProxyGet(w http.ResponseWriter, r *http.Request) {
	s.SaltProxy(w, r)
}

// SaltProxyDelete proxies DELETE to service
func (s *Service) SaltProxyDelete(w http.ResponseWriter, r *http.Request) {
	s.SaltProxy(w, r)
}
