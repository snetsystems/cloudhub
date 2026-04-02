package baremetal

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

type MockClient struct {
	CreateFileFunc                    func(path string, contents []string, targetMinion string) (int, []byte, error)
	RemoveFileFunc                    func(path string, targetMinion string) (int, []byte, error)
	MkdirWithLocalClientFunc          func(path string, targetMinion string) (int, []byte, error)
	DirectoryExistsFunc               func(path string, targetMinion string) (int, []byte, error)
	FileExistsFunc                    func(path string, targetMinion string) (int, []byte, error)
	DockerRestartFunc                 func(path string, targetMinion string, dockerCommand string) (int, []byte, error)
	ServiceReloadWithLocalClientFunc  func(serviceName string, targetMinion string) (int, []byte, error)
	GetWheelKeyAcceptedListAllFunc    func() (int, []byte, error)
	IsActiveMinionPingTestFunc        func(targetMinion string) (int, []byte, error)
}

func (m *MockClient) CreateFileWithLocalClient(path string, contents []string, targetMinion string) (int, []byte, error) {
	if m.CreateFileFunc != nil {
		return m.CreateFileFunc(path, contents, targetMinion)
	}
	return http.StatusOK, nil, nil
}

func (m *MockClient) RemoveFileWithLocalClient(path string, targetMinion string) (int, []byte, error) {
	if m.RemoveFileFunc != nil {
		return m.RemoveFileFunc(path, targetMinion)
	}
	return http.StatusOK, nil, nil
}

func (m *MockClient) MkdirWithLocalClient(path string, targetMinion string) (int, []byte, error) {
	if m.MkdirWithLocalClientFunc != nil {
		return m.MkdirWithLocalClientFunc(path, targetMinion)
	}
	return http.StatusOK, nil, nil
}

func (m *MockClient) DirectoryExistsWithLocalClient(path string, targetMinion string) (int, []byte, error) {
	if m.DirectoryExistsFunc != nil {
		return m.DirectoryExistsFunc(path, targetMinion)
	}

	resp := struct {
		Return []map[string]bool `json:"return"`
	}{
		Return: []map[string]bool{
			{targetMinion: true},
		},
	}
	b, _ := json.Marshal(resp)
	return http.StatusOK, b, nil
}

func (m *MockClient) FileExistsWithLocalClient(path string, targetMinion string) (int, []byte, error) {
	if m.FileExistsFunc != nil {
		return m.FileExistsFunc(path, targetMinion)
	}
	resp := struct {
		Return []map[string]bool `json:"return"`
	}{
		Return: []map[string]bool{
			{targetMinion: false},
		},
	}
	b, _ := json.Marshal(resp)
	return http.StatusOK, b, nil
}

func (m *MockClient) DockerRestart(path string, targetMinion string, dockerCommand string) (int, []byte, error) {
	if m.DockerRestartFunc != nil {
		return m.DockerRestartFunc(path, targetMinion, dockerCommand)
	}
	return http.StatusOK, nil, nil
}

func (m *MockClient) ServiceReloadWithLocalClient(serviceName string, targetMinion string) (int, []byte, error) {
	if m.ServiceReloadWithLocalClientFunc != nil {
		return m.ServiceReloadWithLocalClientFunc(serviceName, targetMinion)
	}
	return http.StatusOK, nil, nil
}

func (m *MockClient) GetWheelKeyAcceptedListAll() (int, []byte, error) {
	if m.GetWheelKeyAcceptedListAllFunc != nil {
		return m.GetWheelKeyAcceptedListAllFunc()
	}
	resp := struct {
		Return []struct {
			Data struct {
				Return struct {
					Minions []string `json:"minions"`
				} `json:"return"`
			} `json:"data"`
		} `json:"return"`
	}{
		Return: []struct {
			Data struct {
				Return struct {
					Minions []string `json:"minions"`
				} `json:"return"`
			} `json:"data"`
		}{
			{
				Data: struct {
					Return struct {
						Minions []string `json:"minions"`
					} `json:"return"`
				}{
					Return: struct {
						Minions []string `json:"minions"`
					}{
						Minions: []string{"ch-collector-1", "minion1"},
					},
				},
			},
		},
	}
	b, _ := json.Marshal(resp)
	return http.StatusOK, b, nil
}

func (m *MockClient) IsActiveMinionPingTest(targetMinion string) (int, []byte, error) {
	if m.IsActiveMinionPingTestFunc != nil {
		return m.IsActiveMinionPingTestFunc(targetMinion)
	}

	resp := struct {
		Return []map[string]bool `json:"return"`
	}{
		Return: []map[string]bool{
			{targetMinion: true},
		},
	}
	b, _ := json.Marshal(resp)
	return http.StatusOK, b, nil
}

func TestDeployLogstashConfig_Success(t *testing.T) {
	mockClient := &MockClient{}
	// Test creating a new BaremetalPlatform
	platform := NewManager(mockClient, "/etc/logstash/conf.d", "/etc/telegraf/telegraf.d", "/usr/bin/docker", "restart logstash")

	// Verify the platform fields
	if platform.logstashPath != "/etc/logstash/conf.d" {
		t.Errorf("Expected LogstashPath to be '/etc/logstash/conf.d', got '%s'", platform.logstashPath)
	}
}

func TestDeployLogstashConfig(t *testing.T) {
	mockClient := new(MockClient)
	platform := NewManager(mockClient, "/tmp", "/etc/telegraf/telegraf.d", "/usr/bin/docker", "restart logstash")
	ctx := context.TODO()

	// Test case 1: Successful deployment (directory exists)
	mockClient.DirectoryExistsFunc = func(path string, targetMinion string) (int, []byte, error) {
		return http.StatusOK, []byte(`{"return": [{"minion1": true}]}`), nil
	}
	mockClient.CreateFileFunc = func(path string, contents []string, targetMinion string) (int, []byte, error) {
		return http.StatusOK, []byte("{}"), nil
	}

	err := platform.DeployLogstashConfig(ctx, "minion1", "test.conf", "some content")
	if err != nil {
		t.Errorf("DeployLogstashConfig failed: %v", err)
	}

	// Test case 2: Successful deployment (directory created)
	mockClient.DirectoryExistsFunc = func(path string, targetMinion string) (int, []byte, error) {
		if targetMinion == "minion2" {
			return http.StatusOK, []byte(`{"return": [{"minion2": false}]}`), nil
		}
		return http.StatusOK, []byte(`{"return": [{"minion1": true}]}`), nil
	}
	mockClient.MkdirWithLocalClientFunc = func(path string, targetMinion string) (int, []byte, error) {
		return http.StatusOK, []byte("{}"), nil
	}
	mockClient.CreateFileFunc = func(path string, contents []string, targetMinion string) (int, []byte, error) {
		return http.StatusOK, []byte("{}"), nil
	}

	err = platform.DeployLogstashConfig(ctx, "minion2", "test.conf", "some content")
	if err != nil {
		t.Errorf("DeployLogstashConfig failed: %v", err)
	}
}

func TestRemoveLogstashConfig_Success(t *testing.T) {
	mockClient := &MockClient{}
	p := NewManager(mockClient, "/tmp/logstash", "", "", "")

	err := p.RemoveLogstashConfig(context.Background(), "minion1", "config.rb")
	if err != nil {
		t.Errorf("RemoveLogstashConfig failed: %v", err)
	}
}
