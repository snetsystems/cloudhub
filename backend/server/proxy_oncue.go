package server

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

// OncueProxy proxies requests to services using the path query parameter.
func (s *Service) OncueProxy(w http.ResponseWriter, r *http.Request) {
	var uri string

	path := r.URL.Query().Get("path")
	uri = singleJoiningSlash(s.AddonURLs["oncue"], path)
	u, err := url.Parse(uri)
	if err != nil {
		msg := fmt.Sprintf("Error parsing oncue url: %v", err)
		Error(w, http.StatusUnprocessableEntity, msg, s.Logger)
		return
	}

	director := func(req *http.Request) {
		req.Host = u.Host
		req.URL = u
	}

	// Without a FlushInterval the HTTP Chunked response for oncue logs is
	// buffered and flushed every 30 seconds.
	proxy := &httputil.ReverseProxy{
		Director:      director,
		FlushInterval: time.Second,
	}

	proxy.ServeHTTP(w, r)
}

// OncueProxyGet proxies GET to service
func (s *Service) OncueProxyGet(w http.ResponseWriter, r *http.Request) {
	s.OncueProxy(w, r)
}
