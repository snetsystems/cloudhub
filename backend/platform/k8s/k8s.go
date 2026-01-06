package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"net/http"
	"sort"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

// Manager for handling Logstash configuration in a Kubernetes environment
type Manager struct {
	client          *kubernetes.Client
	namespace       string
	statefulSetName string
	KafkaProducer   cloudhub.KafkaProducer
	ConfigGenerator cloudhub.ConfigGenerator
	Logger          cloudhub.Logger
}

// NewManager creates a new Manager for handling Logstash configuration in a Kubernetes environment
func NewManager(client *kubernetes.Client, namespace string, statefulSetName string, logger cloudhub.Logger) *Manager {
	return &Manager{
		client:          client,
		namespace:       namespace,
		statefulSetName: statefulSetName,
		Logger:          logger,
	}
}

// PushConfigUpdates triggers the configuration push for Kubernetes collectors for the specified shards.
func (p *Manager) PushConfigUpdates(ctx context.Context, shardIDs []int) {
	if p.KafkaProducer == nil || p.ConfigGenerator == nil {
		return
	}

	affectedShards := make(map[int]bool)
	for _, sid := range shardIDs {
		affectedShards[sid] = true
	}

	for shardID := range affectedShards {
		// Use goroutine for non-blocking publish
		go func(sid int) {
			// Use Background context as the request context might be cancelled
			bgCtx := context.Background()

			configStr, err := p.GenerateShardConfig(bgCtx, sid)
			if err != nil {
				p.Logger.Error(fmt.Sprintf("Kafka: Failed to generate config for shard %d: %v", sid, err))
				return
			}

			err = p.KafkaProducer.PublishConfig(sid, configStr)
			if err != nil {
				p.Logger.Error(fmt.Sprintf("Kafka: Failed to publish config for shard %d: %v", sid, err))
			} else {
				p.Logger.Info(fmt.Sprintf("Kafka: Successfully published config update for shard %d", sid))
			}
		}(shardID)
	}
}

// GetShardID calculates the shard index for a given device ID
func (p *Manager) GetShardID(deviceID string, totalShards int) int {
	if totalShards <= 1 {
		return 0
	}
	hash := crc32.ChecksumIEEE([]byte(deviceID))
	return int(hash) % totalShards
}

// GetTotalShards returns the current number of collector shards/replicas
func (p *Manager) GetTotalShards(ctx context.Context) int {
	totalShards := 1
	replicas, err := p.GetCollectorReplicas(ctx)
	if err == nil && replicas > 0 {
		totalShards = replicas
	} else {
		p.Logger.Info(fmt.Sprintf("Failed to get replicas (err=%v), defaulting to 1", err))
	}
	return totalShards
}

// DeployLogstashConfig deploys a Logstash configuration to a Kubernetes ConfigMap
func (p *Manager) DeployLogstashConfig(ctx context.Context, target string, configName string, content string) error {
	// In the sidecar pull model, the configuration is served via API,
	// so we don't need to push configs to ConfigMaps anymore.
	// This is a no-op.
	return nil
}

// RemoveLogstashConfig removes a Logstash configuration from a Kubernetes ConfigMap
func (p *Manager) RemoveLogstashConfig(ctx context.Context, target string, configName string) error {
	// In the sidecar pull model, this is also a no-op.
	return nil
}

// RestartCollector restarts the Logstash collector in a Kubernetes environment
func (p *Manager) RestartCollector(ctx context.Context, target string) error {
	// K8s environment handles config reloading automatically via sidecar/hot-reload.
	// No-op.
	return nil
}

// GetActiveCollectors returns the active Logstash collectors in a Kubernetes environment
func (p *Manager) GetActiveCollectors(ctx context.Context) ([]string, map[string]bool, error) {
	// For K8s, active collectors are managed by scaling.
	// This method might need to query the actual Pods if we want strict verification,
	// but for now, the backend logic constructs shard list based on total devices.
	// Returning empty here as the backend will self-calculate "shard-0", "shard-1" etc.
	return []string{}, map[string]bool{}, nil
}

// GetCollectorReplicas returns the current number of replicas for the collector service.
func (p *Manager) GetCollectorReplicas(ctx context.Context) (int, error) {
	path := fmt.Sprintf("/apis/apps/v1/namespaces/%s/statefulsets/%s", p.namespace, p.statefulSetName)

	getResp, err := p.client.Do(ctx, "GET", path, nil)
	if err != nil {
		return 0, fmt.Errorf("%w: %v", cloudhub.ErrK8sStatefulSetFetch, err)
	}
	defer getResp.Body.Close()

	if getResp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("%w, status: %d", cloudhub.ErrK8sStatefulSetFetch, getResp.StatusCode)
	}

	var sts struct {
		Spec struct {
			Replicas int `json:"replicas"`
		} `json:"spec"`
	}
	if err := json.NewDecoder(getResp.Body).Decode(&sts); err != nil {
		return 0, fmt.Errorf("%w: %v", cloudhub.ErrK8sStatefulSetDecode, err)
	}

	return sts.Spec.Replicas, nil
}

// GenerateShardConfig generates the Logstash configuration for a specific shard in a Kubernetes environment.
func (p *Manager) GenerateShardConfig(ctx context.Context, shardID int) (string, error) {
	if p.ConfigGenerator == nil {
		return "", fmt.Errorf("config generator not initialized")
	}

	allOrgs, err := p.ConfigGenerator.GetAllNetworkDeviceOrgs(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to fetch accounts: %w", err)
	}

	allDevices, err := p.ConfigGenerator.GetAllNetworkDevices(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to fetch devices: %w", err)
	}

	// Build a map for quick lookup of which devices are active in which org
	activeDevices := make(map[string]map[string]bool) // orgID -> deviceID -> active
	for _, org := range allOrgs {
		activeDevices[org.ID] = make(map[string]bool)
		for _, devID := range org.CollectedDevicesIDs {
			activeDevices[org.ID][devID] = true
		}
	}

	// Group devices by Org that belong to this shard
	shardOrgs := make(map[string]cloudhub.NetworkDeviceOrg)

	for _, dev := range allDevices {
		// Only include if:
		// 1. Device is assigned to this Shard
		// 2. Device belongs to its Org's active collection list
		if dev.ShardID == shardID {
			if isActive, ok := activeDevices[dev.Organization][dev.ID]; ok && isActive {
				orgID := dev.Organization
				filteredOrg, exists := shardOrgs[orgID]
				if !exists {
					// Find original org details
					for _, original := range allOrgs {
						if original.ID == orgID {
							filteredOrg = original
							filteredOrg.CollectedDevicesIDs = []string{} // Reset and refill
							break
						}
					}
				}
				filteredOrg.CollectedDevicesIDs = append(filteredOrg.CollectedDevicesIDs, dev.ID)
				shardOrgs[orgID] = filteredOrg
			}
		}
	}

	var fullConfigBuilder strings.Builder
	var sortedOrgIDs []string
	for orgID := range shardOrgs {
		sortedOrgIDs = append(sortedOrgIDs, orgID)
	}
	sort.Strings(sortedOrgIDs)

	for _, orgID := range sortedOrgIDs {
		orgInfo := shardOrgs[orgID]
		configPart, err := p.ConfigGenerator.GenerateOrgConfig(ctx, &orgInfo)
		if err != nil {
			p.Logger.WithField("org", orgID).WithField("error", err).Error("Failed to generate configuration block")
			continue
		}
		if configPart != "" {
			fullConfigBuilder.WriteString(configPart)
		}
	}

	return fullConfigBuilder.String(), nil
}

// VerifyCollectorReady for K8s always returns nil as the infrastructure manages availability.
func (p *Manager) VerifyCollectorReady(ctx context.Context, collectorName string) error {
	return nil
}
