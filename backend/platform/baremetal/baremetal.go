package baremetal

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"regexp"
	"strings"
	"sync"
)

// Client defines the methods required from the Service to interact with Salt/Local filesystem.
type Client interface {
	CreateFileWithLocalClient(path string, contents []string, targetMinion string) (int, []byte, error)
	RemoveFileWithLocalClient(path string, targetMinion string) (int, []byte, error)
	MkdirWithLocalClient(path string, targetMinion string) (int, []byte, error)
	DirectoryExistsWithLocalClient(path string, targetMinion string) (int, []byte, error)
	DockerRestart(path string, targetMinion string, dockerCommand string) (int, []byte, error)
	GetWheelKeyAcceptedListAll() (int, []byte, error)
	IsActiveMinionPingTest(targetMinion string) (int, []byte, error)
}

// Manager implements the Platform interface for baremetal environments using Salt stack.
type Manager struct {
	client       Client
	logstashPath string
	dockerPath   string
	dockerCmd    string
}

// NewManager creates a new Manager instance.
func NewManager(client Client, logstashPath string, dockerPath string, dockerCmd string) *Manager {
	return &Manager{
		client:       client,
		logstashPath: logstashPath,
		dockerPath:   dockerPath,
		dockerCmd:    dockerCmd,
	}
}

// DeployLogstashConfig deploys a Logstash configuration file to the specified minion.
func (p *Manager) DeployLogstashConfig(ctx context.Context, target string, configName string, content string) error {

	filePath := path.Join(p.logstashPath, configName)

	// Directory check logic copied from manageLogstashConfig
	statusCode, resp, err := p.client.DirectoryExistsWithLocalClient(p.logstashPath, target)
	if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to check directory existence: status=%d err=%v", statusCode, err)
	}

	if resp != nil {
		r := &struct {
			Return []map[string]bool `json:"return"`
		}{}

		if err := json.Unmarshal(resp, r); err != nil {
			return fmt.Errorf("failed to unmarshal salt response: %v", err)
		}

		if len(r.Return) > 0 && !r.Return[0][target] {
			statusCode, _, err := p.client.MkdirWithLocalClient(p.logstashPath, target)
			if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				return fmt.Errorf("failed to create directory: status=%d err=%v", statusCode, err)
			}
		}
	} else {
		return fmt.Errorf("unknown error occurred at DirectoryExists() func")
	}

	statusCode, _, err = p.client.CreateFileWithLocalClient(filePath, []string{content}, target)
	if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to create fileConfig: status=%d err=%v", statusCode, err)
	}

	return nil
}

// RemoveLogstashConfig removes a Logstash configuration file from the specified minion.
func (p *Manager) RemoveLogstashConfig(ctx context.Context, target string, configName string) error {
	filePath := path.Join(p.logstashPath, configName)
	statusCode, _, err := p.client.RemoveFileWithLocalClient(filePath, target)
	if err != nil {
		return err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to remove file: status=%d", statusCode)
	}
	return nil
}

// RestartCollector restarts the Logstash collector on the specified minion.
func (p *Manager) RestartCollector(ctx context.Context, target string) error {
	statusCode, resp, err := p.client.DockerRestart(p.dockerPath, target, p.dockerCmd)
	if err != nil {
		return err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to restart collector: status=%d", statusCode)
	}

	if resp != nil {
		r := &struct {
			Return []map[string]string `json:"return"`
		}{}
		if err := json.Unmarshal(resp, r); err != nil {
			return err
		}
		// Check for the success message using regex
		re := regexp.MustCompile(`(?i)(Restarting.*Started|Stopping .* done|Starting .* done)`)
		for _, item := range r.Return {
			for _, value := range item {
				cleanedValue := strings.ReplaceAll(strings.ReplaceAll(value, "\n", ""), " ", "")
				if !re.MatchString(cleanedValue) {
					return fmt.Errorf("docker restart failed: %s", value)
				}
			}
		}
	}
	return nil
}

// GetActiveCollectors returns a list of active collectors and their status.
func (p *Manager) GetActiveCollectors(ctx context.Context) ([]string, map[string]bool, error) {
	status, responseBody, err := p.client.GetWheelKeyAcceptedListAll()
	if err != nil {
		return nil, nil, err
	}
	if status != 200 {
		return nil, nil, fmt.Errorf("failed to retrieve keys, status code: %d", status)
	}

	var response struct {
		Return []struct {
			Data struct {
				Return struct {
					Minions []string `json:"minions"`
				} `json:"return"`
			} `json:"data"`
		} `json:"return"`
	}

	err = json.Unmarshal(responseBody, &response)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	var collectorKeys []string
	activeCollectorKeys := make(map[string]bool)
	var mu sync.Mutex
	var wg sync.WaitGroup

	if len(response.Return) == 0 {
		return collectorKeys, activeCollectorKeys, nil
	}

	for _, minion := range response.Return[0].Data.Return.Minions {
		if strings.HasPrefix(minion, "ch-collector") {
			collectorKeys = append(collectorKeys, minion)
			wg.Add(1)
			go func(minion string) {
				defer wg.Done()
				isActive := false
				if statusCode, resp, err := p.client.IsActiveMinionPingTest(minion); err == nil && statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices && resp != nil {
					r := &struct {
						Return []map[string]bool `json:"return"`
					}{}
					if json.Unmarshal(resp, r) == nil && len(r.Return) > 0 && r.Return[0][minion] {
						isActive = true
					}
				}
				mu.Lock()
				activeCollectorKeys[minion] = isActive
				mu.Unlock()
			}(minion)
		}
	}

	wg.Wait()
	return collectorKeys, activeCollectorKeys, nil
}

// PushConfigUpdates for baremetal is a no-op as it uses direct file deployment.
func (p *Manager) PushConfigUpdates(ctx context.Context, shardIDs []int) {}

// GetCollectorReplicas for baremetal returns 0 as it's not applicable.
func (p *Manager) GetCollectorReplicas(ctx context.Context) (int, error) {
	return 0, nil
}

// GetTotalShards for baremetal always returns 1 as it doesn't use sharding.
func (p *Manager) GetTotalShards(ctx context.Context) int {
	return 1
}

// GetShardID for baremetal always returns 0.
func (p *Manager) GetShardID(deviceID string, totalShards int) int {
	return 0
}

// VerifyCollectorReady for Baremetal checks if the specific collector minion is active via Salt-ping.
func (p *Manager) VerifyCollectorReady(ctx context.Context, collectorName string) error {
	if collectorName == "" {
		return fmt.Errorf("collector-server name is empty")
	}
	status, _, err := p.client.IsActiveMinionPingTest(collectorName)
	if err != nil {
		return fmt.Errorf("failed to ping collector-server: %w", err)
	}
	if status != http.StatusOK {
		return fmt.Errorf("collector-server is not active")
	}
	return nil
}

// GenerateShardConfig for baremetal is not supported as it doesn't use sharding.
func (p *Manager) GenerateShardConfig(ctx context.Context, shardID int) (string, error) {
	return "", fmt.Errorf("sharding is not supported in baremetal environment")
}
