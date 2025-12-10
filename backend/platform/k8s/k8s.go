package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

// Manager for handling Logstash configuration in a Kubernetes environment
type Manager struct {
	client        *kubernetes.Client
	namespace     string
	configMapName string
}

// NewManager creates a new Manager for handling Logstash configuration in a Kubernetes environment
func NewManager(client *kubernetes.Client, namespace string, configMapName string) *Manager {
	return &Manager{
		client:        client,
		namespace:     namespace,
		configMapName: configMapName,
	}
}

// DeployLogstashConfig deploys a Logstash configuration to a Kubernetes ConfigMap
func (p *Manager) DeployLogstashConfig(ctx context.Context, target string, configName string, content string) error {

	payloadMap := map[string]interface{}{
		"data": map[string]string{
			configName: content,
		},
	}
	payloadBytes, err := json.Marshal(payloadMap)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	path := fmt.Sprintf("/api/v1/namespaces/%s/configmaps/%s", p.namespace, p.configMapName)
	resp, err := p.client.Patch(ctx, path, string(payloadBytes), "application/merge-patch+json")
	if err != nil {
		return fmt.Errorf("failed to patch configmap: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {

		createPayload := map[string]interface{}{
			"apiVersion": "v1",
			"kind":       "ConfigMap",
			"metadata": map[string]string{
				"name":      p.configMapName,
				"namespace": p.namespace,
			},
			"data": map[string]string{
				configName: content,
			},
		}
		createBytes, err := json.Marshal(createPayload)
		if err != nil {
			return fmt.Errorf("failed to marshal create payload: %w", err)
		}
		createPath := fmt.Sprintf("/api/v1/namespaces/%s/configmaps", p.namespace)

		respCreate, errCreate := p.client.Do(ctx, "POST", createPath, string(createBytes))
		if errCreate != nil {
			return fmt.Errorf("failed to create configmap: %w", errCreate)
		}
		defer respCreate.Body.Close()
		if respCreate.StatusCode < 200 || respCreate.StatusCode >= 300 {
			return fmt.Errorf("failed to create configmap: status %d", respCreate.StatusCode)
		}
		return nil
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("failed to patch configmap: status %d", resp.StatusCode)
	}

	return nil
}

// RemoveLogstashConfig removes a Logstash configuration from a Kubernetes ConfigMap
func (p *Manager) RemoveLogstashConfig(ctx context.Context, target string, configName string) error {
	// To remove a key in merge-patch, set it to null
	payloadMap := map[string]interface{}{
		"data": map[string]interface{}{
			configName: nil,
		},
	}
	payloadBytes, err := json.Marshal(payloadMap)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	path := fmt.Sprintf("/api/v1/namespaces/%s/configmaps/%s", p.namespace, p.configMapName)
	resp, err := p.client.Patch(ctx, path, string(payloadBytes), "application/merge-patch+json")
	if err != nil {
		return fmt.Errorf("failed to patch configmap for removal: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if resp.StatusCode == http.StatusNotFound {
			return nil
		}
		return fmt.Errorf("failed to remove config from configmap: status %d", resp.StatusCode)
	}
	return nil
}

// RestartCollector restarts the Logstash collector in a Kubernetes environment
func (p *Manager) RestartCollector(ctx context.Context, target string) error {
	// K8s environment typically handles config reloading automatically.
	// No-op for now.
	return nil
}

// GetActiveCollectors returns the active Logstash collectors in a Kubernetes environment
func (p *Manager) GetActiveCollectors(ctx context.Context) ([]string, map[string]bool, error) {
	// For K8s, we assume the collector service is managed by K8s.
	// We return a default collector "k8s-collector" as active.
	// In the future, this could list pods matching value.
	return []string{"k8s-collector"}, map[string]bool{"k8s-collector": true}, nil
}
