package server

import (
	"crypto/tls"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

// buildKubernetesReverseProxy creates a reverse proxy for Kubernetes API with authentication
func buildKubernetesReverseProxy(targetURL, token string) *httputil.ReverseProxy {
	target, _ := url.Parse(targetURL)

	proxy := httputil.NewSingleHostReverseProxy(target)

	proxy.Transport = &http.Transport{
		IdleConnTimeout:     30 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true, // For self-signed certificates
		},
	}

	proxy.Director = func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.Host = target.Host

		// Set authorization header with Bearer token
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}

		// Set standard Kubernetes API headers
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/json")
	}

	return proxy
}

// KubernetesProxy handles Kubernetes API proxy requests
func (s *Service) KubernetesProxy(w http.ResponseWriter, r *http.Request) {
	// Get the Kubernetes base URL from InternalENV configuration
	kubernetesURL := "https://localhost:9449" // Default to SSH tunnel
	if s.InternalENV.KubernetesConfig.URL != "" {
		kubernetesURL = s.InternalENV.KubernetesConfig.URL
	}

	s.Logger.Info("Kubernetes Proxy called with path: ", r.URL.Path)
	s.Logger.Info("Kubernetes URL: ", kubernetesURL)
	s.Logger.Info("Kubernetes Config: URL=", s.InternalENV.KubernetesConfig.URL,
		", Token length=", len(s.InternalENV.KubernetesConfig.Token),
		", InsecureSkipVerify=", s.InternalENV.KubernetesConfig.InsecureSkipVerify)

	// Extract the path from the URL
	// The URL will be like /cloudhub/v1/kubernetes/proxy/api/v1/namespaces
	// We need to extract everything after /proxy/
	parts := strings.SplitN(r.URL.Path, "/proxy", 2)
	var tail string
	if len(parts) == 2 {
		tail = parts[1] // starts with "/" or may be empty
	}
	if tail == "" {
		tail = "/" // default to Kubernetes root
	}

	s.Logger.Info("Extracted target path: ", tail)

	// Try to get token from existing client or create new one
	var token string
	var err error

	// Create client if not available and configuration exists
	if s.KubernetesClient == nil && s.InternalENV.KubernetesConfig.URL != "" {
		s.Logger.Info("Creating Kubernetes client with token authentication")
		config := kubernetes.Config{
			URL:                s.InternalENV.KubernetesConfig.URL,
			Token:              s.InternalENV.KubernetesConfig.Token,
			InsecureSkipVerify: s.InternalENV.KubernetesConfig.InsecureSkipVerify,
		}
		s.KubernetesClient = kubernetes.NewClient(config, s.Logger)

		// Test connection
		if err := s.KubernetesClient.TestConnection(r.Context()); err != nil {
			s.Logger.Error("Failed to connect to Kubernetes API: ", err)
		} else {
			s.Logger.Info("Successfully connected to Kubernetes API")
		}
	}

	// Try to get token
	if s.KubernetesClient != nil {
		token, err = s.KubernetesClient.GetToken(r.Context())
		if err != nil {
			s.Logger.Error("Failed to get token: ", err)
		} else {
			s.Logger.Info("Successfully obtained token, length: ", len(token))
			if len(token) < 10 {
				s.Logger.Error("Token seems too short, might be invalid")
			}
		}
	}

	// Use authenticated proxy if we have a token
	if token != "" {
		s.Logger.Info("Using authenticated proxy with token")
		// Build reverse proxy with authentication
		proxy := buildKubernetesReverseProxy(kubernetesURL, token)
		proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, e error) {
			s.Logger.Error("Authenticated proxy error: ", e)
			s.Logger.Error("Request URL: ", req.URL.String())
			s.Logger.Error("Request method: ", req.Method)
			rw.WriteHeader(http.StatusBadGateway)
		}

		r.URL.Scheme = "" // overwritten by Director
		r.URL.Host = ""
		r.URL.Path = tail  // "/api/v1/namespaces" …
		r.URL.RawPath = "" // let proxy re‑encode
		r.Host = ""        // Host header will be set by proxy

		proxy.ServeHTTP(w, r)
	} else {
		// Fallback to basic reverse proxy if no token available
		s.Logger.Info("No authentication token available, using unauthenticated proxy")

		target, err := url.Parse(kubernetesURL)
		if err != nil {
			s.Logger.Error("Failed to parse Kubernetes URL: ", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		s.Logger.Info("Target URL: ", target.String())
		proxy := httputil.NewSingleHostReverseProxy(target)

		proxy.Transport = &http.Transport{
			IdleConnTimeout:     30 * time.Second,
			TLSHandshakeTimeout: 10 * time.Second,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // For self-signed certificates
			},
		}

		proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, e error) {
			s.Logger.Error("Unauthenticated proxy error: ", e)
			s.Logger.Error("Request URL: ", req.URL.String())
			s.Logger.Error("Request method: ", req.Method)
			s.Logger.Error("Target URL: ", target.String())
			rw.WriteHeader(http.StatusBadGateway)
		}

		// Set up the request URL
		r.URL.Scheme = ""
		r.URL.Host = ""
		r.URL.Path = tail
		r.URL.RawPath = ""
		r.Host = ""

		proxy.ServeHTTP(w, r)
	}
}
