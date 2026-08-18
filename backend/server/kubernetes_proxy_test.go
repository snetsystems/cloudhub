package server

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

type kubernetesProxyRecordingLogger struct {
	messages []string
}

func (l *kubernetesProxyRecordingLogger) record(args ...interface{}) {
	l.messages = append(l.messages, fmt.Sprint(args...))
}

func (l *kubernetesProxyRecordingLogger) Debug(args ...interface{}) { l.record(args...) }
func (l *kubernetesProxyRecordingLogger) Info(args ...interface{})  { l.record(args...) }
func (l *kubernetesProxyRecordingLogger) Error(args ...interface{}) { l.record(args...) }

func (l *kubernetesProxyRecordingLogger) WithField(string, interface{}) cloudhub.Logger {
	return l
}

func (l *kubernetesProxyRecordingLogger) Writer() *io.PipeWriter { return nil }

func TestBuildKubernetesReverseProxyPreservesJSONPatchRequestAndResponse(t *testing.T) {
	const patchBody = `[
  {"op":"test","path":"/metadata/resourceVersion","value":"rv-policy-1"},
  {"op":"test","path":"/spec/ingress/0/ports/0/port","value":8081},
  {"op":"replace","path":"/spec/ingress/0/ports/0/port","value":8080}
]`
	const statusBody = `{"kind":"Status","reason":"Conflict"}`

	type receivedRequest struct {
		method        string
		path          string
		rawQuery      string
		contentType   string
		authorization string
		body          string
	}
	received := make(chan receivedRequest, 1)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
			return
		}
		received <- receivedRequest{
			method:        r.Method,
			path:          r.URL.Path,
			rawQuery:      r.URL.RawQuery,
			contentType:   r.Header.Get("Content-Type"),
			authorization: r.Header.Get("Authorization"),
			body:          string(body),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_, _ = io.WriteString(w, statusBody)
	}))
	defer upstream.Close()

	proxy := buildKubernetesReverseProxy(upstream.URL, "upstream-token", false)
	req := httptest.NewRequest(
		http.MethodPatch,
		"http://cloudhub.example/apis/networking.k8s.io/v1/namespaces/demo/networkpolicies/allow?fieldManager=demo-agent",
		strings.NewReader(patchBody),
	)
	req.Header.Set("Content-Type", "application/json-patch+json")
	response := httptest.NewRecorder()

	proxy.ServeHTTP(response, req)

	got := <-received
	if got.method != http.MethodPatch {
		t.Errorf("method = %q, want PATCH", got.method)
	}
	if got.path != "/apis/networking.k8s.io/v1/namespaces/demo/networkpolicies/allow" {
		t.Errorf("path = %q", got.path)
	}
	if got.rawQuery != "fieldManager=demo-agent" {
		t.Errorf("query = %q", got.rawQuery)
	}
	if got.contentType != "application/json-patch+json" {
		t.Errorf("content type = %q, want application/json-patch+json", got.contentType)
	}
	if got.authorization != "Bearer upstream-token" {
		t.Errorf("authorization = %q", got.authorization)
	}
	if got.body != patchBody {
		t.Errorf("body = %q", got.body)
	}
	if response.Code != http.StatusConflict {
		t.Errorf("status = %d, want %d", response.Code, http.StatusConflict)
	}
	if response.Body.String() != statusBody {
		t.Errorf("response body = %q", response.Body.String())
	}
}

func TestBuildKubernetesReverseProxyHonorsTLSVerificationSetting(t *testing.T) {
	upstream := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	upstream.Config.ErrorLog = log.New(io.Discard, "", 0)
	upstream.StartTLS()
	defer upstream.Close()

	tests := []struct {
		name               string
		insecureSkipVerify bool
		wantStatus         int
	}{
		{name: "verify certificate", insecureSkipVerify: false, wantStatus: http.StatusBadGateway},
		{name: "allow configured self-signed certificate", insecureSkipVerify: true, wantStatus: http.StatusNoContent},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			proxy := buildKubernetesReverseProxy(upstream.URL, "", test.insecureSkipVerify)
			proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
				w.WriteHeader(http.StatusBadGateway)
			}
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "http://cloudhub.example/api/v1/namespaces", nil)

			proxy.ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Errorf("status = %d, want %d", response.Code, test.wantStatus)
			}
		})
	}
}

func TestKubernetesProxyDoesNotLogTokenMetadata(t *testing.T) {
	const token = "secret-prefix-never-log-rest"

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	logger := &kubernetesProxyRecordingLogger{}
	service := &Service{
		Logger: logger,
		InternalENV: cloudhub.InternalEnvironment{
			KubernetesConfig: cloudhub.KubernetesConfig{
				URL:   upstream.URL,
				Token: token,
			},
		},
		KubernetesClient: kubernetes.NewClient(kubernetes.Config{
			URL:   upstream.URL,
			Token: token,
		}, logger),
	}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"http://cloudhub.example/cloudhub/v1/kubernetes/proxy/api/v1/namespaces",
		nil,
	)

	service.KubernetesProxy(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	joined := strings.Join(logger.messages, "\n")
	for _, forbidden := range []string{
		token,
		"secret-pre",
		"Token length=",
		"Successfully obtained token, length:",
	} {
		if strings.Contains(joined, forbidden) {
			t.Fatalf("log contains token-derived value %q", forbidden)
		}
	}
}

func TestKubernetesServiceProxyRequiresCollectorToken(t *testing.T) {
	const (
		collectorToken  = "collector-service-secret"
		kubernetesToken = "kubernetes-service-account-secret"
	)

	received := make(chan *http.Request, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Clone(r.Context())
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	logger := &kubernetesProxyRecordingLogger{}
	service := Service{
		Logger: logger,
		InternalENV: cloudhub.InternalEnvironment{KubernetesConfig: cloudhub.KubernetesConfig{
			URL:                upstream.URL,
			Token:              kubernetesToken,
			CollectorAuthToken: collectorToken,
		}},
		KubernetesClient: kubernetes.NewClient(kubernetes.Config{
			URL:   upstream.URL,
			Token: kubernetesToken,
		}, logger),
	}
	handler := NewMux(MuxOpts{Logger: logger, UseAuth: true}, service)
	endpoint := "/api/v1/kubernetes/proxy/api/v1/namespaces/network-repair-demo"

	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, endpoint, nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d, want %d", unauthorized.Code, http.StatusUnauthorized)
	}
	select {
	case <-received:
		t.Fatal("unauthorized request reached Kubernetes")
	default:
	}

	authorizedRequest := httptest.NewRequest(http.MethodGet, endpoint, nil)
	authorizedRequest.Header.Set("Authorization", "Bearer "+collectorToken)
	authorized := httptest.NewRecorder()
	handler.ServeHTTP(authorized, authorizedRequest)
	if authorized.Code != http.StatusOK {
		t.Fatalf("authorized status = %d, want %d", authorized.Code, http.StatusOK)
	}

	got := <-received
	if got.URL.Path != "/api/v1/namespaces/network-repair-demo" {
		t.Errorf("upstream path = %q", got.URL.Path)
	}
	if got.Header.Get("Authorization") != "Bearer "+kubernetesToken {
		t.Errorf("upstream authorization did not use the Kubernetes token")
	}
}
