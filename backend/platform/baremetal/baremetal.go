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

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Client defines the methods required from the Service to interact with Salt/Local filesystem.
type Client interface {
	CreateFileWithLocalClient(path string, contents []string, targetMinion string) (int, []byte, error)
	RemoveFileWithLocalClient(path string, targetMinion string) (int, []byte, error)
	MkdirWithLocalClient(path string, targetMinion string) (int, []byte, error)
	DirectoryExistsWithLocalClient(path string, targetMinion string) (int, []byte, error)
	FileExistsWithLocalClient(path string, targetMinion string) (int, []byte, error)
	DockerRestart(path string, targetMinion string, dockerCommand string) (int, []byte, error)
	ServiceReloadWithLocalClient(serviceName string, targetMinion string) (int, []byte, error)
	GetWheelKeyAcceptedListAll() (int, []byte, error)
	IsActiveMinionPingTest(targetMinion string) (int, []byte, error)
}

// DeployTelegrafConfigWithClient writes a Telegraf drop-in under telegrafPath on collectorName using Salt.
// Shared by baremetal and Kubernetes (where Logstash uses pull/Kafka but URL monitoring still uses Salt → node).
func DeployTelegrafConfigWithClient(client Client, telegrafPath, collectorName, configName, content string) error {
	if client == nil {
		return fmt.Errorf("telegraf deploy: nil Salt client")
	}
	filePath := path.Join(telegrafPath, configName)
	subDir := path.Dir(filePath)
	if err := ensureTelegrafDir(client, collectorName, subDir); err != nil {
		return err
	}
	statusCode, _, err := client.CreateFileWithLocalClient(filePath, []string{content}, collectorName)
	if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to create telegraf config: status=%d err=%v", statusCode, err)
	}
	return nil
}

// RemoveTelegrafConfigWithClient removes a Telegraf drop-in file via Salt.
func RemoveTelegrafConfigWithClient(client Client, telegrafPath, collectorName, configName string) error {
	if client == nil {
		return fmt.Errorf("telegraf remove: nil Salt client")
	}
	filePath := path.Join(telegrafPath, configName)
	statusCode, _, err := client.RemoveFileWithLocalClient(filePath, collectorName)
	if err != nil {
		return err
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to remove telegraf config: status=%d", statusCode)
	}
	return nil
}

// RestartTelegrafWithClient runs systemctl reload telegraf on the minion via Salt.
func RestartTelegrafWithClient(client Client, collectorName string) error {
	if client == nil {
		return fmt.Errorf("telegraf restart: nil Salt client")
	}
	statusCode, _, err := client.ServiceReloadWithLocalClient("telegraf", collectorName)
	if err != nil {
		return err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to reload telegraf service: status=%d", statusCode)
	}
	return nil
}

func ensureTelegrafDir(client Client, collectorName, dirPath string) error {
	statusCode, resp, err := client.DirectoryExistsWithLocalClient(dirPath, collectorName)
	if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("failed to check directory %q: status=%d err=%v", dirPath, statusCode, err)
	}
	if resp == nil {
		return fmt.Errorf("empty response checking directory %q", dirPath)
	}

	r := &struct {
		Return []map[string]bool `json:"return"`
	}{}
	if err := json.Unmarshal(resp, r); err != nil {
		return fmt.Errorf("failed to unmarshal salt response: %v", err)
	}
	if len(r.Return) > 0 && !r.Return[0][collectorName] {
		statusCode, _, err := client.MkdirWithLocalClient(dirPath, collectorName)
		if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			return fmt.Errorf("failed to create directory %q: status=%d err=%v", dirPath, statusCode, err)
		}
	}
	return nil
}

// Manager implements the Platform interface for baremetal environments using Salt stack.
type Manager struct {
	client       Client
	logstashPath string
	telegrafPath string
	dockerPath   string
	dockerCmd    string
}

// NewManager creates a new Manager instance.
func NewManager(client Client, logstashPath string, telegrafPath string, dockerPath string, dockerCmd string) *Manager {
	return &Manager{
		client:       client,
		logstashPath: logstashPath,
		telegrafPath: telegrafPath,
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

// GetActiveCollectorsFromClient returns ch-collector-* minions and their ping status
// using the provided Salt client. Shared by baremetal.Manager and k8s.Manager.
func GetActiveCollectorsFromClient(client Client) ([]string, map[string]bool, error) {
	if client == nil {
		return nil, nil, fmt.Errorf("GetActiveCollectors: nil Salt client")
	}
	status, responseBody, err := client.GetWheelKeyAcceptedListAll()
	if err != nil {
		return nil, nil, err
	}
	if status < http.StatusOK || status >= http.StatusMultipleChoices {
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
				if statusCode, resp, err := client.IsActiveMinionPingTest(minion); err == nil && statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices && resp != nil {
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

// GetActiveCollectors returns a list of active collectors and their status.
func (p *Manager) GetActiveCollectors(ctx context.Context) ([]string, map[string]bool, error) {
	return GetActiveCollectorsFromClient(p.client)
}

// PushConfigUpdates for baremetal is a no-op as it uses direct file deployment.
func (p *Manager) PushConfigUpdates(ctx context.Context, shardIDs []int) {}

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

// CheckFileExistsWithClient checks if filePath exists on collectorName via Salt.
// Shared by baremetal.Manager and k8s.Manager.
func CheckFileExistsWithClient(client Client, collectorName, filePath string) (bool, error) {
	if client == nil {
		return false, fmt.Errorf("CheckFileExists: nil Salt client")
	}
	statusCode, resp, err := client.FileExistsWithLocalClient(filePath, collectorName)
	if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return false, fmt.Errorf("failed to check file existence: status=%d err=%v", statusCode, err)
	}

	r := &struct {
		Return []map[string]bool `json:"return"`
	}{}
	if err := json.Unmarshal(resp, r); err != nil {
		return false, fmt.Errorf("failed to unmarshal salt response: %v", err)
	}
	if len(r.Return) > 0 {
		return r.Return[0][collectorName], nil
	}
	return false, nil
}

// CheckFileExists checks if a file exists at the given path on the specified collector minion.
func (p *Manager) CheckFileExists(ctx context.Context, collectorName string, filePath string) (bool, error) {
	return CheckFileExistsWithClient(p.client, collectorName, filePath)
}

// DeployTelegrafConfig deploys a Telegraf configuration file to the specified collector minion via Salt.
// The file is placed at {telegrafPath}/{configName} on the target minion.
// It ensures every directory component of configName (e.g. "url-monitoring/") exists before writing.
func (p *Manager) DeployTelegrafConfig(ctx context.Context, collectorName string, configName string, content string) error {
	return DeployTelegrafConfigWithClient(p.client, p.telegrafPath, collectorName, configName, content)
}

// RemoveTelegrafConfig removes a Telegraf configuration file from the specified collector minion via Salt.
func (p *Manager) RemoveTelegrafConfig(ctx context.Context, collectorName string, configName string) error {
	return RemoveTelegrafConfigWithClient(p.client, p.telegrafPath, collectorName, configName)
}

// RestartTelegraf reloads Telegraf on the specified collector via systemctl.
func (p *Manager) RestartTelegraf(ctx context.Context, collectorName string) error {
	return RestartTelegrafWithClient(p.client, collectorName)
}

// GenerateShardConfig for baremetal is not supported as it doesn't use sharding.
func (p *Manager) GenerateShardConfig(ctx context.Context, shardID int) (string, error) {
	return "", fmt.Errorf("sharding is not supported in baremetal environment")
}

// Compile-time check: Manager implements cloudhub.Platform
var _ cloudhub.Platform = (*Manager)(nil)
