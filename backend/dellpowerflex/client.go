package dellpowerflex

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Token represents the Dell PowerFlex authentication token
type Token struct {
	AccessToken      string    `json:"access_token"`
	ExpiresIn        int       `json:"expires_in"`
	RefreshToken     string    `json:"refresh_token"`
	RefreshExpiresIn int       `json:"refresh_expires_in"`
	TokenType        string    `json:"token_type"`
	IDToken          string    `json:"id_token"`
	NotBeforePolicy  int       `json:"not-before-policy"`
	SessionState     string    `json:"session_state"`
	Scope            string    `json:"scope"`
	CreatedAt        time.Time `json:"-"`
}

// LoginRequest represents the login request
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RefreshRequest represents the token refresh request
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Config contains settings for constructing a new Dell PowerFlex client
type Config struct {
	URL                string
	Username           string
	Password           string
	InsecureSkipVerify bool
}

// Client wraps the Dell PowerFlex API client
type Client struct {
	config     Config
	httpClient *http.Client
	token      *Token
	tokenMutex sync.RWMutex
	logger     cloudhub.Logger
}

// NewClient creates a new Dell PowerFlex client
func NewClient(cfg Config, logger cloudhub.Logger) *Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: cfg.InsecureSkipVerify,
		},
		IdleConnTimeout:     30 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}

	return &Client{
		config:     cfg,
		httpClient: client,
		logger:     logger,
	}
}

// Login authenticates with Dell PowerFlex and stores the token
func (c *Client) Login(ctx context.Context) error {
	loginURL := fmt.Sprintf("%s/rest/auth/login", strings.TrimSuffix(c.config.URL, "/"))

	loginReq := LoginRequest{
		Username: c.config.Username,
		Password: c.config.Password,
	}

	jsonData, err := json.Marshal(loginReq)
	if err != nil {
		return fmt.Errorf("failed to marshal login request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", loginURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create login request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to perform login request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("login failed with status: %d", resp.StatusCode)
	}

	var token Token
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return fmt.Errorf("failed to decode login response: %w", err)
	}

	// Log token details for debugging
	c.logger.Info("Login response - TokenType: ", token.TokenType)
	c.logger.Info("Login response - ExpiresIn: ", token.ExpiresIn, " seconds")
	c.logger.Info("Login response - RefreshExpiresIn: ", token.RefreshExpiresIn, " seconds")
	c.logger.Info("Login response - AccessToken length: ", len(token.AccessToken))

	// Validate token type
	if token.TokenType != "bearer" && token.TokenType != "Bearer" {
		c.logger.Error("Unexpected token type: ", token.TokenType, ", expected 'bearer'")
	}

	// 토큰을 받은 후 생성 시간 설정
	token.CreatedAt = time.Now()

	c.tokenMutex.Lock()
	c.token = &token
	c.tokenMutex.Unlock()

	c.logger.Info("Successfully logged in to Dell PowerFlex")
	c.logger.Info("Token received - AccessToken length: ", len(token.AccessToken))
	c.logger.Info("Token received - ExpiresIn: ", token.ExpiresIn)
	return nil
}

// RefreshToken refreshes the access token using the refresh token
func (c *Client) RefreshToken(ctx context.Context) error {
	c.tokenMutex.RLock()
	refreshToken := c.token.RefreshToken
	c.tokenMutex.RUnlock()

	if refreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	refreshURL := fmt.Sprintf("%s/rest/auth/update-token", strings.TrimSuffix(c.config.URL, "/"))

	refreshReq := RefreshRequest{
		RefreshToken: refreshToken,
	}

	jsonData, err := json.Marshal(refreshReq)
	if err != nil {
		return fmt.Errorf("failed to marshal refresh request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", refreshURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create refresh request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to perform refresh request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("token refresh failed with status: %d", resp.StatusCode)
	}

	var token Token
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return fmt.Errorf("failed to decode refresh response: %w", err)
	}

	// 새 토큰을 받은 후 생성 시간 설정
	token.CreatedAt = time.Now()

	c.tokenMutex.Lock()
	c.token = &token
	c.tokenMutex.Unlock()

	c.logger.Info("Successfully refreshed Dell PowerFlex token")
	return nil
}

// GetToken returns the current access token, automatically logging in if not authenticated
func (c *Client) GetToken(ctx context.Context) (string, error) {
	c.tokenMutex.RLock()
	token := c.token
	c.tokenMutex.RUnlock()

	if token == nil {
		// No token, need to login automatically
		c.logger.Info("No token found, attempting auto-login")
		if err := c.Login(ctx); err != nil {
			return "", fmt.Errorf("failed to auto-login: %w", err)
		}
		c.tokenMutex.RLock()
		token = c.token
		c.tokenMutex.RUnlock()
	}

	// Check if token is expired (with 30 second buffer)
	// Dell PowerFlex tokens expire in 5 minutes (300 seconds)
	if token.ExpiresIn > 0 {

		timeSinceCreation := time.Since(token.CreatedAt)
		remainingTime := time.Duration(token.ExpiresIn)*time.Second - timeSinceCreation

		if remainingTime < 30*time.Second {
			c.logger.Info("Token expiring soon (expires in ", remainingTime.Seconds(), " seconds), attempting refresh")
			if err := c.RefreshToken(ctx); err != nil {
				c.logger.Error("Failed to refresh token, attempting re-login: ", err)
				if err := c.Login(ctx); err != nil {
					return "", fmt.Errorf("failed to re-login after refresh failure: %w", err)
				}
				c.tokenMutex.RLock()
				token = c.token
				c.tokenMutex.RUnlock()
			} else {
				c.tokenMutex.RLock()
				token = c.token
				c.tokenMutex.RUnlock()
			}
		}
	}

	c.logger.Info("Returning token - length: ", len(token.AccessToken))
	return token.AccessToken, nil
}

// IsLoggedIn checks if the client is currently logged in
func (c *Client) IsLoggedIn() bool {
	c.tokenMutex.RLock()
	defer c.tokenMutex.RUnlock()
	return c.token != nil && c.token.AccessToken != ""
}

// EnsureLoggedIn ensures the client is logged in, performing auto-login if necessary
func (c *Client) EnsureLoggedIn(ctx context.Context) error {
	if !c.IsLoggedIn() {
		c.logger.Info("Client not logged in, performing auto-login")
		return c.Login(ctx)
	}
	return nil
}

// DoRequest performs an authenticated request to Dell PowerFlex API
// Automatically handles login if not authenticated or token is expired
func (c *Client) DoRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	// First, try to get a valid token (this will auto-login if needed)
	token, err := c.GetToken(ctx)
	if err != nil {
		c.logger.Error("Failed to get token, attempting auto-login: ", err)
		// Try to login again
		if err := c.Login(ctx); err != nil {
			return nil, fmt.Errorf("failed to login automatically: %w", err)
		}
		// Get token again after successful login
		token, err = c.GetToken(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get token after auto-login: %w", err)
		}
	}

	// Ensure proper URL formatting with slash
	url := fmt.Sprintf("%s/%s", strings.TrimSuffix(c.config.URL, "/"), strings.TrimPrefix(path, "/"))

	var bodyReader *bytes.Buffer
	if body != nil {
		// Handle different body types
		switch v := body.(type) {
		case string:
			if v != "" {
				bodyReader = bytes.NewBufferString(v)
			}
		case []byte:
			if len(v) > 0 {
				bodyReader = bytes.NewBuffer(v)
			}
		default:
			// Try to marshal as JSON
			jsonData, err := json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}
			if len(jsonData) > 0 {
				bodyReader = bytes.NewBuffer(jsonData)
			}
		}
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	// Set Content-Type based on body type
	if bodyReader != nil {
		switch body.(type) {
		case string:
			req.Header.Set("Content-Type", "text/plain")
		default:
			req.Header.Set("Content-Type", "application/json")
		}
	} else {
		req.Header.Set("Content-Type", "application/json")
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to perform request: %w", err)
	}

	// If we get 401, try to login again and retry once
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		c.logger.Info("Received 401, attempting auto-login and retry")

		// Clear the current token and try to login again
		c.tokenMutex.Lock()
		c.token = nil
		c.tokenMutex.Unlock()

		if err := c.Login(ctx); err != nil {
			return nil, fmt.Errorf("failed to login after 401: %w", err)
		}

		// Retry the request with new token
		token, err := c.GetToken(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get new token after login: %w", err)
		}

		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		resp, err = c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to retry request: %w", err)
		}
	}

	return resp, nil
}

// Logout logs out from Dell PowerFlex
func (c *Client) Logout(ctx context.Context) error {
	c.tokenMutex.RLock()
	refreshToken := c.token.RefreshToken
	c.tokenMutex.RUnlock()

	if refreshToken == "" {
		return nil // Already logged out
	}

	logoutURL := fmt.Sprintf("%s/rest/auth/logout", strings.TrimSuffix(c.config.URL, "/"))

	logoutReq := RefreshRequest{
		RefreshToken: refreshToken,
	}

	jsonData, err := json.Marshal(logoutReq)
	if err != nil {
		return fmt.Errorf("failed to marshal logout request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", logoutURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create logout request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	// Use the current access token for logout
	token, err := c.GetToken(ctx)
	if err == nil {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to perform logout request: %w", err)
	}
	defer resp.Body.Close()

	// Clear the token regardless of response
	c.tokenMutex.Lock()
	c.token = nil
	c.tokenMutex.Unlock()

	c.logger.Info("Successfully logged out from Dell PowerFlex")
	return nil
}
