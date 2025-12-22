package platform

import "context"

// Platform defines the interface for platform-specific operations.
type Platform interface {
	// DeployLogstashConfig deploys the given content as a Logstash configuration.
	// target is the identifier for the destination (e.g., Salt minion ID for baremetal).
	// configName is typically the filename or the key in a ConfigMap.
	DeployLogstashConfig(ctx context.Context, target string, configName string, content string) error

	// RemoveLogstashConfig removes the specified Logstash configuration.
	RemoveLogstashConfig(ctx context.Context, target string, configName string) error

	// RestartCollector restarts the collector service if necessary.
	RestartCollector(ctx context.Context, target string) error

	// GetActiveCollectors returns the list of all collectors and a map of their active status.
	GetActiveCollectors(ctx context.Context) ([]string, map[string]bool, error)

	// GetCollectorReplicas returns the current number of replicas for the collector service.
	GetCollectorReplicas(ctx context.Context) (int, error)
}
