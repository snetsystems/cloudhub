package k8s

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

type MockLogger struct{}

func (m *MockLogger) Debug(...interface{})                          {}
func (m *MockLogger) Info(...interface{})                           {}
func (m *MockLogger) Error(...interface{})                          {}
func (m *MockLogger) WithField(string, interface{}) cloudhub.Logger { return m }
func (m *MockLogger) Writer() *io.PipeWriter                        { return nil }

func TestDeployLogstashConfig_PatchSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PATCH" && r.URL.Path == "/api/v1/namespaces/default/configmaps/logstash-pipeline" {
			if r.Header.Get("Content-Type") != "application/merge-patch+json" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := kubernetes.NewClient(kubernetes.Config{URL: server.URL}, &MockLogger{})
	p := NewManager(client, "default", "logstash-pipeline")

	err := p.DeployLogstashConfig(context.Background(), "target", "config.rb", "content")
	if err != nil {
		t.Errorf("DeployLogstashConfig failed: %v", err)
	}
}

func TestDeployLogstashConfig_CreateSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PATCH" && r.URL.Path == "/api/v1/namespaces/default/configmaps/logstash-pipeline" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/api/v1/namespaces/default/configmaps" {
			w.WriteHeader(http.StatusCreated)
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := kubernetes.NewClient(kubernetes.Config{URL: server.URL}, &MockLogger{})
	p := NewManager(client, "default", "logstash-pipeline")

	err := p.DeployLogstashConfig(context.Background(), "target", "config.rb", "content")
	if err != nil {
		t.Errorf("DeployLogstashConfig failed: %v", err)
	}
}

func TestRemoveLogstashConfig_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PATCH" && r.URL.Path == "/api/v1/namespaces/default/configmaps/logstash-pipeline" {
			body, _ := io.ReadAll(r.Body)
			if !strings.Contains(string(body), `"config.rb":null`) {
				t.Errorf("Expected null in body for removal, got: %s", body)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := kubernetes.NewClient(kubernetes.Config{URL: server.URL}, &MockLogger{})
	p := NewManager(client, "default", "logstash-pipeline")

	err := p.RemoveLogstashConfig(context.Background(), "target", "config.rb")
	if err != nil {
		t.Errorf("RemoveLogstashConfig failed: %v", err)
	}
}
