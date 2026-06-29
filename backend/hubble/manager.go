package hubble

import (
	"context"
	"sort"
	"sync"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ClusterConfig identifies a single Kubernetes cluster's Hubble Relay endpoint.
type ClusterConfig struct {
	Name   string
	Client ClientConfig
}

// ManagerConfig is the top-level configuration loaded from CloudHub flags/env.
// Aggregation parameters apply uniformly to every cluster; per-cluster
// connection settings live on each ClusterConfig.
type ManagerConfig struct {
	Window           time.Duration
	Bucket           time.Duration
	SnapshotInterval time.Duration
	MaxEdges         int
	ExcludedPatterns *ExcludedNamespacePatterns
	Clusters         []ClusterConfig
}

// Manager owns one ClusterRuntime per configured cluster and exposes a
// read-only registry for HTTP/WS handlers.
type Manager struct {
	cfg      ManagerConfig
	logger   cloudhub.Logger
	runtimes map[string]*ClusterRuntime

	mu      sync.Mutex
	started bool
}

// NewManager constructs a Manager and instantiates a ClusterRuntime for each
// configured cluster. Start must be called separately to begin connecting.
func NewManager(cfg ManagerConfig, logger cloudhub.Logger) *Manager {
	m := &Manager{
		cfg:      cfg,
		logger:   logger,
		runtimes: map[string]*ClusterRuntime{},
	}
	for _, cc := range cfg.Clusters {
		rc := RuntimeConfig{
			ClusterName:      cc.Name,
			Window:           cfg.Window,
			Bucket:           cfg.Bucket,
			SnapshotInterval: cfg.SnapshotInterval,
			MaxEdges:         cfg.MaxEdges,
			ExcludedPatterns: cfg.ExcludedPatterns,
			Client:           cc.Client,
		}
		m.runtimes[cc.Name] = NewClusterRuntime(rc, logger)
	}
	return m
}

// Start launches every cluster runtime. Errors from individual cluster
// validations are logged and skipped so a single bad config does not
// prevent the rest from running.
func (m *Manager) Start(ctx context.Context) error {
	m.mu.Lock()
	if m.started {
		m.mu.Unlock()
		return nil
	}
	m.started = true
	m.mu.Unlock()

	for name, rt := range m.runtimes {
		if err := rt.Start(ctx); err != nil {
			if m.logger != nil {
				m.logger.WithField("cluster", name).Error("hubble: start failed: ", err)
			}
		}
	}
	return nil
}

// Runtime returns the runtime for the named cluster or nil if unknown.
func (m *Manager) Runtime(name string) *ClusterRuntime {
	return m.runtimes[name]
}

// ClusterNames returns the configured cluster names in alphabetical order.
func (m *Manager) ClusterNames() []string {
	names := make([]string, 0, len(m.runtimes))
	for n := range m.runtimes {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}
