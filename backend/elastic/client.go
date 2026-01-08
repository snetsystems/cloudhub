// Package elastic provides a shared-transport Elasticsearch client.
package elastic

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
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
	Authentication     string
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

	switch {
	case cfg.Authentication == cloudhub.APIkeyMethod && cfg.APIKeyAuth != nil:
		esCfg.APIKey = base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s",
			cfg.APIKeyAuth.ID,
			cfg.APIKeyAuth.APIKey,
		)))
	case cfg.Authentication == cloudhub.BasicMethod && cfg.BasicAuth != nil:
		esCfg.Username = cfg.BasicAuth.Username
		esCfg.Password = cfg.BasicAuth.Password
	default:
		return nil, fmt.Errorf(
			"authentication required: either apiKey or basic must be set",
		)
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

// Es returns the official go-elasticsearch Client.
func (c *Client) Es() *elasticsearch.Client {
	return c.es
}

// DistinctHostsBefore returns a set of hostnames that have at least one
// document in `indexPattern` older than N days.
func (c *Client) DistinctHostsBefore(
	ctx context.Context,
	indexPattern string,
	daysAgo int,
) (map[string]cloudhub.ESInfo, error) {

	body := map[string]any{
		"size": 0,
		"query": map[string]any{
			"range": map[string]any{
				"@timestamp": map[string]string{
					"gte": fmt.Sprintf("now-%dd", daysAgo),
					"lte": "now",
				},
			},
		},
		"aggs": map[string]any{
			"hosts": map[string]any{
				"terms": map[string]any{
					"field":          "host.hostname",
					"size":           10_000,
					"shard_size":     20_000,
					"execution_hint": "map",
				},
				"aggs": map[string]any{
					"sample": map[string]any{
						"top_hits": map[string]any{
							"size": 1,
							"_source": []string{
								"host.ip",
								"deviceType",
							},
							"sort": []any{
								map[string]any{
									"@timestamp": map[string]string{
										"order": "desc",
									},
								},
							},
						},
					},
				},
			},
		},
	}
	reqBody, _ := json.Marshal(body)

	res, err := c.es.Search(
		c.es.Search.WithContext(ctx),
		c.es.Search.WithIndex(indexPattern),
		c.es.Search.WithBody(bytes.NewReader(reqBody)),
		c.es.Search.WithTrackTotalHits(false),
	)
	if err != nil {
		return nil, fmt.Errorf("es search error: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("es error %s", res.Status())
	}

	var resp struct {
		Aggregations struct {
			Hosts struct {
				Buckets []struct {
					Key    string `json:"key"`
					Sample struct {
						Hits struct {
							Hits []struct {
								Source struct {
									Host struct {
										IP string `json:"ip"`
									} `json:"host"`
									DeviceType string `json:"deviceType"`
								} `json:"_source"`
							} `json:"hits"`
						} `json:"hits"`
					} `json:"sample"`
				} `json:"buckets"`
			} `json:"hosts"`
		} `json:"aggregations"`
	}

	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	out := make(map[string]cloudhub.ESInfo, len(resp.Aggregations.Hosts.Buckets))
	for _, b := range resp.Aggregations.Hosts.Buckets {
		if len(b.Sample.Hits.Hits) == 0 {
			continue
		}
		doc := b.Sample.Hits.Hits[0].Source
		out[b.Key] = cloudhub.ESInfo{
			IP:         doc.Host.IP,
			DeviceType: doc.DeviceType,
		}
	}
	return out, nil
}

// GetLatestHostInfo returns the latest ESInfo for a hostname.
func (c *Client) GetLatestHostInfo(
	ctx context.Context,
	indexPattern, hostname string,
	lookbackDays int,
) (cloudhub.ESInfo, bool, error) {

	if hostname == "" {
		return cloudhub.ESInfo{}, false, fmt.Errorf("hostname is required")
	}

	filter := []any{
		map[string]any{"term": map[string]any{"host.hostname": hostname}},
	}
	if lookbackDays > 0 {
		filter = append(filter, map[string]any{
			"range": map[string]any{
				"@timestamp": map[string]any{
					"gte": fmt.Sprintf("now-%dd", lookbackDays),
					"lte": "now",
				},
			},
		})
	}

	body := map[string]any{
		"size": 1,
		"query": map[string]any{
			"bool": map[string]any{
				"filter": filter,
			},
		},
		"sort": []any{
			map[string]any{
				"@timestamp": map[string]any{"order": "desc"},
			},
		},
		"_source": []string{"host.ip", "deviceType", "device.type"},
	}

	reqBytes, err := json.Marshal(body)
	if err != nil {
		return cloudhub.ESInfo{}, false, fmt.Errorf("marshal body: %w", err)
	}

	res, err := c.es.Search(
		c.es.Search.WithContext(ctx),
		c.es.Search.WithIndex(indexPattern),
		c.es.Search.WithBody(bytes.NewReader(reqBytes)),
		c.es.Search.WithTrackTotalHits(false),
	)
	if err != nil {
		return cloudhub.ESInfo{}, false, err
	}
	defer res.Body.Close()

	if res.IsError() {
		return cloudhub.ESInfo{}, false, fmt.Errorf("es error %s", res.Status())
	}

	var esResp struct {
		Hits struct {
			Hits []struct {
				Source struct {
					Host struct {
						IP string `json:"ip"`
					} `json:"host"`

					DeviceType string `json:"deviceType"`

					Device struct {
						Type string `json:"type"`
					} `json:"device"`
				} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(res.Body).Decode(&esResp); err != nil {
		return cloudhub.ESInfo{}, false, err
	}

	if len(esResp.Hits.Hits) == 0 {
		return cloudhub.ESInfo{}, false, nil
	}

	src := esResp.Hits.Hits[0].Source
	deviceType := src.DeviceType
	if deviceType == "" {
		deviceType = src.Device.Type
	}

	return cloudhub.ESInfo{
		IP:         src.Host.IP,
		DeviceType: deviceType,
	}, true, nil
}
