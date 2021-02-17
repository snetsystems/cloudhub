package server

import (
	"fmt"
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
	"strconv"
)

// KapacitorProxy proxies requests to services using the path query parameter.
func (s *Service) KapacitorProxy(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	path := params.Get("path")
	kid := params.Get("kid")
	email := params.Get("email")

	if path == "" {
		Error(w, http.StatusUnprocessableEntity, "path query parameter required", s.Logger)
		return
	}
	if kid == "" {
		Error(w, http.StatusUnprocessableEntity, "kid query parameter required", s.Logger)
		return
	}
	if email == "" {
		Error(w, http.StatusUnprocessableEntity, "email query parameter required", s.Logger)
		return
	}

	id, err := strconv.Atoi(kid)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("Error converting ID %s", kid), s.Logger)
		return
	}

	ctx := serverContext(r.Context())
	kapacitor, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	uri := singleJoiningSlash(kapacitor.URL, path)
	u, err := url.Parse(uri)
	if err != nil {
		msg := fmt.Sprintf("Error parsing kapacitor url: %v", err)
		Error(w, http.StatusUnprocessableEntity, msg, s.Logger)
		return
	}

	director := func(req *http.Request) {
		// Set the Host header of the original Kapacitor URL
		req.Host = u.Host
		req.URL = u

		// Because we are acting as a proxy, kapacitor needs to have the basic auth information set as
		// a header directly
		if kapacitor.Username != "" && kapacitor.Password != "" {
			req.SetBasicAuth(kapacitor.Username, kapacitor.Password)
		}
	}

	// Without a FlushInterval the HTTP Chunked response for kapacitor logs is
	// buffered and flushed every 30 seconds.
	proxy := &httputil.ReverseProxy{
		Director:      director,
		FlushInterval: time.Second,
	}

	// The connection to kapacitor is using a self-signed certificate.
	// This modifies uses the same values as http.DefaultTransport but specifies
	// InsecureSkipVerify
	if kapacitor.InsecureSkipVerify {
		proxy.Transport = &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
				DualStack: true,
			}).DialContext,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
		}
	}
	proxy.ServeHTTP(w, r)
}

// KapacitorProxyPost proxies POST to service
func (s *Service) KapacitorProxyPost(w http.ResponseWriter, r *http.Request) {
	s.KapacitorProxy(w, r)
}