package k8s

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/platform/baremetal"
)

type MockLogger struct{}

func (m *MockLogger) Debug(...interface{})                          {}
func (m *MockLogger) Info(...interface{})                           {}
func (m *MockLogger) Error(...interface{})                          {}
func (m *MockLogger) WithField(string, interface{}) cloudhub.Logger { return m }
func (m *MockLogger) Writer() *io.PipeWriter                        { return nil }

func TestDeployLogstashConfig_NoOp(t *testing.T) {
	// Since we moved to pull model, this should just return nil without any API calls.
	p := NewManager(nil, 0, &MockLogger{})
	err := p.DeployLogstashConfig(context.Background(), "target", "config.rb", "content")
	if err != nil {
		t.Errorf("expected no error from no-op, got: %v", err)
	}
}

func TestRemoveLogstashConfig_NoOp(t *testing.T) {
	// Since we moved to pull model, this should just return nil without any API calls.
	p := NewManager(nil, 0, &MockLogger{})
	err := p.RemoveLogstashConfig(context.Background(), "target", "config.rb")
	if err != nil {
		t.Errorf("expected no error from no-op, got: %v", err)
	}
}

// mockSaltClient implements baremetal.Client for testing.
type mockSaltClient struct {
	wheelKeyFunc   func() (int, []byte, error)
	pingFunc       func(minion string) (int, []byte, error)
	fileExistsFunc func(path, minion string) (int, []byte, error)
}

func (m *mockSaltClient) GetWheelKeyAcceptedListAll() (int, []byte, error) {
	if m.wheelKeyFunc != nil {
		return m.wheelKeyFunc()
	}
	return http.StatusOK, mustMarshal(wheelKeyResponse([]string{})), nil
}

func (m *mockSaltClient) IsActiveMinionPingTest(minion string) (int, []byte, error) {
	if m.pingFunc != nil {
		return m.pingFunc(minion)
	}
	return http.StatusOK, mustMarshal(map[string]interface{}{
		"return": []map[string]bool{{minion: true}},
	}), nil
}

func (m *mockSaltClient) FileExistsWithLocalClient(path, minion string) (int, []byte, error) {
	if m.fileExistsFunc != nil {
		return m.fileExistsFunc(path, minion)
	}
	return http.StatusOK, mustMarshal(map[string]interface{}{
		"return": []map[string]bool{{minion: false}},
	}), nil
}

// Unused baremetal.Client methods — no-op stubs.
func (m *mockSaltClient) CreateFileWithLocalClient(path string, contents []string, minion string) (int, []byte, error) {
	return http.StatusOK, nil, nil
}
func (m *mockSaltClient) RemoveFileWithLocalClient(path, minion string) (int, []byte, error) {
	return http.StatusOK, nil, nil
}
func (m *mockSaltClient) MkdirWithLocalClient(path, minion string) (int, []byte, error) {
	return http.StatusOK, nil, nil
}
func (m *mockSaltClient) DirectoryExistsWithLocalClient(path, minion string) (int, []byte, error) {
	return http.StatusOK, nil, nil
}
func (m *mockSaltClient) DockerRestart(path, minion, cmd string) (int, []byte, error) {
	return http.StatusOK, nil, nil
}
func (m *mockSaltClient) ServiceReloadWithLocalClient(svc, minion string) (int, []byte, error) {
	return http.StatusOK, nil, nil
}

// wheelKeyResponse builds a Salt wheel.key.list_all response body.
func wheelKeyResponse(minions []string) interface{} {
	return map[string]interface{}{
		"return": []map[string]interface{}{
			{
				"data": map[string]interface{}{
					"return": map[string]interface{}{
						"minions": minions,
					},
				},
			},
		},
	}
}

func mustMarshal(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

// ── GetActiveCollectors tests ─────────────────────────────────────────────────

func TestGetActiveCollectors_NilSaltClient(t *testing.T) {
	mgr := &Manager{} // telegrafSalt not set

	keys, active, err := mgr.GetActiveCollectors(context.Background())

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(keys) != 0 {
		t.Errorf("expected empty keys, got %v", keys)
	}
	if len(active) != 0 {
		t.Errorf("expected empty active map, got %v", active)
	}
}

func TestGetActiveCollectors_FiltersByPrefix(t *testing.T) {
	// Salt returns ch-collector-0, ch-collector-1, and an unrelated minion.
	saltMinions := []string{"ch-collector-0", "ch-collector-1", "some-other-minion"}

	client := &mockSaltClient{
		wheelKeyFunc: func() (int, []byte, error) {
			return http.StatusOK, mustMarshal(wheelKeyResponse(saltMinions)), nil
		},
		pingFunc: func(minion string) (int, []byte, error) {
			// ch-collector-0 active, ch-collector-1 inactive
			active := minion == "ch-collector-0"
			return http.StatusOK, mustMarshal(map[string]interface{}{
				"return": []map[string]bool{{minion: active}},
			}), nil
		},
	}

	mgr := &Manager{}
	mgr.SetTelegrafSaltDeployment(client, "/etc/telegraf/telegraf.d")

	keys, activeMap, err := mgr.GetActiveCollectors(context.Background())

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(keys) != 2 {
		t.Fatalf("expected 2 collector keys, got %d: %v", len(keys), keys)
	}
	for _, k := range keys {
		if k == "some-other-minion" {
			t.Errorf("non-collector minion should be filtered out")
		}
	}
	if !activeMap["ch-collector-0"] {
		t.Errorf("ch-collector-0 should be active")
	}
	if activeMap["ch-collector-1"] {
		t.Errorf("ch-collector-1 should be inactive")
	}
}

// ── CheckFileExists tests ──────────────────────────────────────────────────────

func TestCheckFileExists_NilSaltClient(t *testing.T) {
	mgr := &Manager{}

	exists, err := mgr.CheckFileExists(context.Background(), "ch-collector-0", "/etc/telegraf/telegraf.d/url-monitoring/org1.conf")

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if exists {
		t.Error("expected false when salt client is nil")
	}
}

func TestCheckFileExists_FileExists(t *testing.T) {
	const minion = "ch-collector-0"
	const filePath = "/etc/telegraf/telegraf.d/url-monitoring/org1.conf"

	client := &mockSaltClient{
		fileExistsFunc: func(path, m string) (int, []byte, error) {
			return http.StatusOK, mustMarshal(map[string]interface{}{
				"return": []map[string]bool{{m: true}},
			}), nil
		},
	}

	mgr := &Manager{}
	mgr.SetTelegrafSaltDeployment(client, "/etc/telegraf/telegraf.d")

	exists, err := mgr.CheckFileExists(context.Background(), minion, filePath)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !exists {
		t.Error("expected file to exist")
	}
}

func TestCheckFileExists_FileNotExists(t *testing.T) {
	const minion = "ch-collector-0"

	client := &mockSaltClient{
		fileExistsFunc: func(path, m string) (int, []byte, error) {
			return http.StatusOK, mustMarshal(map[string]interface{}{
				"return": []map[string]bool{{m: false}},
			}), nil
		},
	}

	mgr := &Manager{}
	mgr.SetTelegrafSaltDeployment(client, "/etc/telegraf/telegraf.d")

	exists, err := mgr.CheckFileExists(context.Background(), minion, "/etc/telegraf/telegraf.d/url-monitoring/org1.conf")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exists {
		t.Error("expected file to not exist")
	}
}

// Compile-time check: mockSaltClient implements baremetal.Client
var _ baremetal.Client = (*mockSaltClient)(nil)
