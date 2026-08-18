package cloudhubproxy

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestClientDoForwardsRequestsUnderCloudHubProxyRoot(t *testing.T) {
	type receivedRequest struct {
		method        string
		requestURI    string
		contentType   string
		authorization string
		body          string
	}
	received := make(chan receivedRequest, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read body: %v", err)
			return
		}
		received <- receivedRequest{
			method:        r.Method,
			requestURI:    r.URL.RequestURI(),
			contentType:   r.Header.Get("Content-Type"),
			authorization: r.Header.Get("Authorization"),
			body:          string(body),
		}
		_, _ = io.WriteString(w, `{"kind":"NetworkPolicy"}`)
	}))
	defer server.Close()

	client, err := New(server.URL+"/api/v1/kubernetes/proxy/", "mcp-service-secret", server.Client())
	if err != nil {
		t.Fatal(err)
	}

	getBody, err := client.Do(
		context.Background(),
		http.MethodGet,
		"/apis/networking.k8s.io/v1/namespaces/demo/networkpolicies?limit=10",
		nil,
		"",
	)
	if err != nil {
		t.Fatal(err)
	}
	if string(getBody) != `{"kind":"NetworkPolicy"}` {
		t.Errorf("GET response = %q", string(getBody))
	}
	getRequest := <-received
	if getRequest.method != http.MethodGet {
		t.Errorf("GET method = %q", getRequest.method)
	}
	if getRequest.requestURI != "/api/v1/kubernetes/proxy/apis/networking.k8s.io/v1/namespaces/demo/networkpolicies?limit=10" {
		t.Errorf("GET URI = %q", getRequest.requestURI)
	}
	if getRequest.authorization != "Bearer mcp-service-secret" {
		t.Errorf("GET sent Authorization = %q", getRequest.authorization)
	}

	const patchBody = `[{"op":"replace","path":"/spec/ingress/0/ports/0/port","value":8080}]`
	_, err = client.Do(
		context.Background(),
		http.MethodPatch,
		"/apis/networking.k8s.io/v1/namespaces/demo/networkpolicies/allow",
		[]byte(patchBody),
		"application/json-patch+json",
	)
	if err != nil {
		t.Fatal(err)
	}
	patchRequest := <-received
	if patchRequest.method != http.MethodPatch {
		t.Errorf("PATCH method = %q", patchRequest.method)
	}
	if patchRequest.contentType != "application/json-patch+json" {
		t.Errorf("PATCH content type = %q", patchRequest.contentType)
	}
	if patchRequest.authorization != "Bearer mcp-service-secret" {
		t.Errorf("PATCH sent Authorization = %q", patchRequest.authorization)
	}
	if patchRequest.body != patchBody {
		t.Errorf("PATCH body = %q", patchRequest.body)
	}
}

func TestClientDoReturnsTypedHTTPError(t *testing.T) {
	tests := []struct {
		status int
		body   string
	}{
		{status: http.StatusNotFound, body: `{"reason":"NotFound"}`},
		{status: http.StatusConflict, body: `{"reason":"Conflict"}`},
	}

	for _, test := range tests {
		t.Run(http.StatusText(test.status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.status)
				_, _ = io.WriteString(w, test.body)
			}))
			defer server.Close()
			client, err := New(server.URL+"/proxy", "mcp-service-secret", server.Client())
			if err != nil {
				t.Fatal(err)
			}

			_, err = client.Do(context.Background(), http.MethodGet, "/api/v1/namespaces/demo", nil, "")
			var httpErr *HTTPError
			if !errors.As(err, &httpErr) {
				t.Fatalf("error = %T %v, want *HTTPError", err, err)
			}
			if httpErr.StatusCode != test.status {
				t.Errorf("status = %d, want %d", httpErr.StatusCode, test.status)
			}
			if string(httpErr.Body) != test.body {
				t.Errorf("body = %q", string(httpErr.Body))
			}
		})
	}
}

func TestClientDoRejectsUnsafePathsBeforeHTTP(t *testing.T) {
	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
	}))
	defer server.Close()
	client, err := New(server.URL+"/api/v1/kubernetes/proxy", "mcp-service-secret", server.Client())
	if err != nil {
		t.Fatal(err)
	}

	for _, unsafePath := range []string{
		"api/v1/namespaces",
		"/api/v1/namespaces/../secrets",
		"/api/v1/namespaces/%2e%2e/secrets",
	} {
		if _, err := client.Do(context.Background(), http.MethodGet, unsafePath, nil, ""); err == nil {
			t.Errorf("Do() accepted unsafe path %q", unsafePath)
		}
	}
	if got := requestCount.Load(); got != 0 {
		t.Fatalf("unsafe paths made %d HTTP requests", got)
	}
}

func TestClientDoRejectsOversizedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, strings.Repeat("x", 1024*1024+1))
	}))
	defer server.Close()
	client, err := New(server.URL+"/proxy", "mcp-service-secret", server.Client())
	if err != nil {
		t.Fatal(err)
	}

	if _, err := client.Do(context.Background(), http.MethodGet, "/api/v1/namespaces", nil, ""); err == nil {
		t.Fatal("Do() accepted a response larger than 1 MiB")
	}
}

func TestNewRejectsInvalidProxyURL(t *testing.T) {
	for _, rawURL := range []string{"", "/proxy", "ftp://cloudhub.example/proxy"} {
		if _, err := New(rawURL, "mcp-service-secret", nil); err == nil {
			t.Errorf("New() accepted %q", rawURL)
		}
	}
}

func TestNewRejectsEmptyServiceToken(t *testing.T) {
	if _, err := New("https://cloudhub.example/api/v1/kubernetes/proxy", "", nil); err == nil {
		t.Fatal("New() accepted an empty service token")
	}
}
