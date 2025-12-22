package k8s

import (
	"context"
	"io"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type MockLogger struct{}

func (m *MockLogger) Debug(...interface{})                          {}
func (m *MockLogger) Info(...interface{})                           {}
func (m *MockLogger) Error(...interface{})                          {}
func (m *MockLogger) WithField(string, interface{}) cloudhub.Logger { return m }
func (m *MockLogger) Writer() *io.PipeWriter                        { return nil }

func TestDeployLogstashConfig_NoOp(t *testing.T) {
	// Since we moved to pull model, this should just return nil without any API calls.
	p := NewManager(nil, "default", "logstash-logstash")
	err := p.DeployLogstashConfig(context.Background(), "target", "config.rb", "content")
	if err != nil {
		t.Errorf("expected no error from no-op, got: %v", err)
	}
}

func TestRemoveLogstashConfig_NoOp(t *testing.T) {
	// Since we moved to pull model, this should just return nil without any API calls.
	p := NewManager(nil, "default", "logstash-logstash")
	err := p.RemoveLogstashConfig(context.Background(), "target", "config.rb")
	if err != nil {
		t.Errorf("expected no error from no-op, got: %v", err)
	}
}
