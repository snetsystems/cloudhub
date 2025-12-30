package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

// Manager for handling Logstash configuration in a Kubernetes environment
type Manager struct {
	client          *kubernetes.Client
	namespace       string
	statefulSetName string
}

// NewManager creates a new Manager for handling Logstash configuration in a Kubernetes environment
func NewManager(client *kubernetes.Client, namespace string, statefulSetName string) *Manager {
	return &Manager{
		client:          client,
		namespace:       namespace,
		statefulSetName: statefulSetName,
	}
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
