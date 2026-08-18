package cloudhubproxy

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const maxResponseBytes = 1024 * 1024

type Client struct {
	baseURL      *url.URL
	serviceToken string
	httpClient   *http.Client
}

type HTTPError struct {
	StatusCode int
	Body       []byte
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("CloudHub Kubernetes proxy returned HTTP %d", e.StatusCode)
}

func New(rawURL, serviceToken string, httpClient *http.Client) (*Client, error) {
	baseURL, err := url.Parse(strings.TrimRight(strings.TrimSpace(rawURL), "/"))
	if err != nil || baseURL.Host == "" || (baseURL.Scheme != "http" && baseURL.Scheme != "https") {
		return nil, fmt.Errorf("proxy URL must be an absolute HTTP or HTTPS URL")
	}
	if baseURL.RawQuery != "" || baseURL.Fragment != "" {
		return nil, fmt.Errorf("proxy URL must not contain a query or fragment")
	}
	serviceToken = strings.TrimSpace(serviceToken)
	if serviceToken == "" {
		return nil, fmt.Errorf("CloudHub proxy service token is required")
	}

	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	} else if httpClient.Timeout == 0 {
		clientCopy := *httpClient
		clientCopy.Timeout = 30 * time.Second
		httpClient = &clientCopy
	}

	return &Client{baseURL: baseURL, serviceToken: serviceToken, httpClient: httpClient}, nil
}

func (c *Client) Do(
	ctx context.Context,
	method string,
	apiPath string,
	body []byte,
	contentType string,
) ([]byte, error) {
	requestURL, err := c.requestURL(apiPath)
	if err != nil {
		return nil, err
	}

	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}
	request, err := http.NewRequestWithContext(ctx, method, requestURL.String(), bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create CloudHub proxy request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+c.serviceToken)
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("call CloudHub Kubernetes proxy: %w", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read CloudHub proxy response: %w", err)
	}
	if len(responseBody) > maxResponseBytes {
		return nil, fmt.Errorf("CloudHub proxy response exceeds 1 MiB")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, &HTTPError{
			StatusCode: response.StatusCode,
			Body:       append([]byte(nil), responseBody...),
		}
	}
	return responseBody, nil
}

func (c *Client) requestURL(apiPath string) (*url.URL, error) {
	if !strings.HasPrefix(apiPath, "/") {
		return nil, fmt.Errorf("API path must start with /")
	}
	reference, err := url.ParseRequestURI(apiPath)
	if err != nil || reference.IsAbs() || reference.Host != "" {
		return nil, fmt.Errorf("invalid API path")
	}
	decodedPath, err := url.PathUnescape(reference.EscapedPath())
	if err != nil {
		return nil, fmt.Errorf("invalid API path escaping")
	}
	for _, segment := range strings.Split(decodedPath, "/") {
		if segment == ".." {
			return nil, fmt.Errorf("API path must not contain .. segments")
		}
	}

	destination := *c.baseURL
	destination.Path = strings.TrimRight(c.baseURL.Path, "/") + reference.Path
	if c.baseURL.RawPath != "" || reference.RawPath != "" {
		destination.RawPath = strings.TrimRight(c.baseURL.EscapedPath(), "/") + reference.EscapedPath()
	}
	destination.RawQuery = reference.RawQuery
	destination.Fragment = ""
	return &destination, nil
}
