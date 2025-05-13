package elastic

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/elastic/go-elasticsearch/v8"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Config holds the settings for ES connection, mirroring cloudhub.EsSource.
type Config struct {
	URL                string
	BasicAuth          *cloudhub.BasicAuth
	APIKeyAuth         *cloudhub.APIKeyAuth
	InsecureSkipVerify bool
}

// Client wraps the elasticsearch.Client
type Client struct {
	es *elasticsearch.Client
}

// InfoResponse is the result of ElasticSearch
type InfoResponse struct {
	Version struct {
		Number string `json:"number"`
	} `json:"version"`
}

// NewClient creates an Elasticsearch client with given config.
func NewClient(cfg Config) (*Client, error) {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{
		InsecureSkipVerify: cfg.InsecureSkipVerify,
	}

	esCfg := elasticsearch.Config{
		Addresses: []string{cfg.URL},
		Transport: transport,
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
		return nil, fmt.Errorf("failed to create ES client: %w", err)
	}

	return &Client{es: es}, nil
}

// Ping checks the connections of a ElasticSearch.
func (c *Client) Ping(ctx context.Context) error {
	res, err := c.es.Info(
		c.es.Info.WithContext(ctx),
	)
	if err != nil {
		return fmt.Errorf("ES ping error: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("ES ping returned error status: %s", res.Status())
	}
	return nil
}

// Version returns the version of the ElasticSearch
func (c *Client) Version(ctx context.Context) (string, error) {
	res, err := c.es.Info(
		c.es.Info.WithContext(ctx),
	)
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
