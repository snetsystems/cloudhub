package server

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/snetsystems/cloudhub/backend/dellpowerflex"
)

// DellPowerFlexToken represents the token response from Dell PowerFlex
type DellPowerFlexToken struct {
	AccessToken      string `json:"access_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	TokenType        string `json:"token_type"`
	IDToken          string `json:"id_token"`
	NotBeforePolicy  int    `json:"not-before-policy"`
	SessionState     string `json:"session_state"`
	Scope            string `json:"scope"`
}

// DellPowerFlexProxy handles Dell PowerFlex API proxy requests
func (s *Service) DellPowerFlexProxy(w http.ResponseWriter, r *http.Request) {
	// Get the Dell PowerFlex base URL from InternalENV configuration
	dellPowerFlexURL := "https://localhost:9448" // Default to SSH tunnel
	if s.InternalENV.DellPowerFlexConfig.URL != "" {
		dellPowerFlexURL = s.InternalENV.DellPowerFlexConfig.URL
	}

	s.Logger.Info("Dell PowerFlex Proxy called with path: ", r.URL.Path)

	// Extract the path from the URL
	// The URL will be like /cloudhub/v1/dell-powerflex/proxy/rest/v1/users
	// We need to extract everything after /proxy/
	parts := strings.SplitN(r.URL.Path, "/proxy", 2)
	var tail string
	if len(parts) == 2 {
		tail = parts[1] // starts with "/" or may be empty
	}
	if tail == "" {
		tail = "/" // default to Dell PowerFlex root
	}

	s.Logger.Info("Extracted target path: ", tail)

	// Try to get token from existing client or create new one
	var token string
	var err error

	// Create client if not available and configuration exists
	if s.DellPowerFlexClient == nil && s.InternalENV.DellPowerFlexConfig.URL != "" {
		s.Logger.Info("Creating Dell PowerFlex client with auto-login capability")
		config := dellpowerflex.Config{
			URL:                s.InternalENV.DellPowerFlexConfig.URL,
			Username:           s.InternalENV.DellPowerFlexConfig.Username,
			Password:           s.InternalENV.DellPowerFlexConfig.Password,
			InsecureSkipVerify: true, // For self-signed certificates
		}
		s.DellPowerFlexClient = dellpowerflex.NewClient(config, s.Logger)
	}

	// Try to get token (this will auto-login if needed)
	if s.DellPowerFlexClient != nil {
		token, err = s.DellPowerFlexClient.GetToken(r.Context())
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

		// Build reverse proxy with authentication
		proxy := buildDellPowerFlexReverseProxy(dellPowerFlexURL, token)
		proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, e error) {
			s.Logger.WithField("err", e)
			rw.WriteHeader(http.StatusBadGateway)
		}

		r.URL.Scheme = "" // overwritten by Director
		r.URL.Host = ""
		r.URL.Path = tail  // "/rest/v1/users" …
		r.URL.RawPath = "" // let proxy re‑encode
		r.Host = ""        // Host header will be set by proxy

		proxy.ServeHTTP(w, r)
	} else {
		// Fallback to basic reverse proxy if no token available
		s.Logger.Info("No authentication token available, using unauthenticated proxy")

		target, _ := url.Parse(dellPowerFlexURL)
		proxy := httputil.NewSingleHostReverseProxy(target)

		proxy.Transport = &http.Transport{
			IdleConnTimeout:     30 * time.Second,
			TLSHandshakeTimeout: 10 * time.Second,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // For self-signed certificates
			},
		}

		proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, e error) {
			s.Logger.Error("Dell PowerFlex proxy error: ", e)
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

// buildDellPowerFlexReverseProxy creates a reverse proxy with authentication
func buildDellPowerFlexReverseProxy(targetURL, token string) *httputil.ReverseProxy {
	target, _ := url.Parse(targetURL)
	rp := httputil.NewSingleHostReverseProxy(target)

	rp.Transport = &http.Transport{
		IdleConnTimeout:     30 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true, // For self-signed certificates
		},
	}

	rp.Director = func(req *http.Request) {
		// Preserve original method/URL from incoming ServeHTTP call
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host

		// Inject authentication header
		authHeader := fmt.Sprintf("Bearer %s", token)
		req.Header.Set("Authorization", authHeader)

		// Set Accept header - try multiple formats for compatibility
		req.Header.Set("Accept", "application/json, */*")

		// Only set Content-Type for non-GET requests
		if req.Method != "GET" && req.Method != "HEAD" {
			req.Header.Set("Content-Type", "application/json")
		}

	}

	return rp
}
