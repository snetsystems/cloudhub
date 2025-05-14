// Package elastic provides a shared-transport Elasticsearch client.
package elastic

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var (
	defaultTransport    *http.Transport
	skipVerifyTransport *http.Transport
	transportOnce       sync.Once
)

// initTransports initializes two shared *http.Transport instances exactly once:
// 1) defaultTransport is a Clone() of http.DefaultTransport.
// 2) skipVerifyTransport is the same Clone() with InsecureSkipVerify = true.
func initTransports() {
	base, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		// Fallback in the unlikely case DefaultTransport isn't *http.Transport
		base = &http.Transport{
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
		}
	}

	// Clone the base transport for reuse
	defaultTransport = base.Clone()
	skipVerifyTransport = base.Clone()

	// Only skipVerifyTransport will skip TLS verification
	skipVerifyTransport.TLSClientConfig = &tls.Config{
		InsecureSkipVerify: true,
	}
}

// SharedTransport returns one of the shared transports.
// Calling SharedTransport(false) always returns defaultTransport.
// Calling SharedTransport(true) always returns skipVerifyTransport.
func SharedTransport(skipVerify bool) *http.Transport {
	transportOnce.Do(initTransports)
	if skipVerify {
		return skipVerifyTransport
	}
	return defaultTransport
}

// Config contains settings for constructing a new ES client.
type Config struct {
	URL                string
	BasicAuth          *cloudhub.BasicAuth
	APIKeyAuth         *cloudhub.APIKeyAuth
	InsecureSkipVerify bool
}

// Client wraps the official go-elasticsearch Client.
type Client struct {
	es *elasticsearch.Client
}

// NewClient creates an Elasticsearch client using the shared transport.
// It applies BasicAuth or APIKeyAuth if provided in the Config.
func NewClient(cfg Config) (*Client, error) {
	esCfg := elasticsearch.Config{
		Addresses: []string{cfg.URL},
		Transport: SharedTransport(cfg.InsecureSkipVerify),
	}

	if cfg.BasicAuth != nil {
		esCfg.Username = cfg.BasicAuth.Username
		esCfg.Password = cfg.BasicAuth.Password
	}

	if cfg.APIKeyAuth != nil {
		esCfg.APIKey = fmt.Sprintf("%s:%s", cfg.APIKeyAuth.ID, cfg.APIKeyAuth.APIKey)
	}

	es, err := elasticsearch.NewClient(esCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Elasticsearch client: %w", err)
	}

	return &Client{es: es}, nil
}

// Ping issues an Info request to verify connectivity.
func (c *Client) Ping(ctx context.Context) error {
	res, err := c.es.Info(c.es.Info.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("ES ping error: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("ES ping returned error status: %s", res.Status())
	}

	return nil
}

// InfoResponse models the JSON structure of the ES Info API response.
type InfoResponse struct {
	Version struct {
		Number string `json:"number"`
	} `json:"version"`
}

// Version returns the Elasticsearch version number.
func (c *Client) Version(ctx context.Context) (string, error) {
	res, err := c.es.Info(c.es.Info.WithContext(ctx))
	if err != nil {
		return "", fmt.Errorf("ES version request error: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return "", fmt.Errorf("ES version responded with status: %s", res.Status())
	}

	var info InfoResponse
	if err := json.NewDecoder(res.Body).Decode(&info); err != nil {
		return "", fmt.Errorf("failed to decode ES version response: %w", err)
	}

	return info.Version.Number, nil
}
