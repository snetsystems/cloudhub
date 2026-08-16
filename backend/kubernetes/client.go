package kubernetes

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strings"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Config contains settings for constructing a new Kubernetes client
type Config struct {
	URL                string
	Token              string
	InsecureSkipVerify bool
}

// Client wraps the Kubernetes API client
type Client struct {
	config     Config
	httpClient *http.Client
	logger     cloudhub.Logger
}

// NewClient creates a new Kubernetes client
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

// GetToken returns the current token (for compatibility with Dell PowerFlex client interface)
func (c *Client) GetToken(ctx context.Context) (string, error) {
	if c.config.Token == "" {
		return "", fmt.Errorf("no token configured")
	}

	return c.config.Token, nil
}

// Do performs an HTTP request to the Kubernetes API
func (c *Client) Do(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	url := fmt.Sprintf("%s%s", strings.TrimSuffix(c.config.URL, "/"), path)

	var req *http.Request
	var err error

	if body != nil {
		bodyStr, ok := body.(string)
		if !ok {
			return nil, fmt.Errorf("body must be a string")
		}
		req, err = http.NewRequestWithContext(ctx, method, url, strings.NewReader(bodyStr))
	} else {
		req, err = http.NewRequestWithContext(ctx, method, url, nil)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set authorization header with Bearer token
	if c.config.Token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.config.Token))
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	return c.httpClient.Do(req)
}

// TestConnection tests the connection to Kubernetes API server
func (c *Client) TestConnection(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.config.URL+"/api/v1/namespaces", nil)
	if err != nil {
		return fmt.Errorf("failed to create test request: %w", err)
	}

	// Set authorization header with Bearer token
	if c.config.Token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.config.Token))
	}

	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to Kubernetes API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Kubernetes API returned status: %d", resp.StatusCode)
	}

	c.logger.Info("Successfully connected to Kubernetes API")
	return nil
}

// Patch performs a PATCH request to the Kubernetes API
func (c *Client) Patch(ctx context.Context, path string, body string, contentType string) (*http.Response, error) {
	url := fmt.Sprintf("%s%s", strings.TrimSuffix(c.config.URL, "/"), path)

	req, err := http.NewRequestWithContext(ctx, "PATCH", url, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if c.config.Token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.config.Token))
	}

	req.Header.Set("Accept", "application/json")
	if contentType == "" {
		contentType = "application/merge-patch+json"
	}
	req.Header.Set("Content-Type", contentType)

	return c.httpClient.Do(req)
}
