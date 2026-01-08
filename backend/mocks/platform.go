package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// MockPlatform is a mock implementation of the Platform interface for testing.
type MockPlatform struct {
	DeployLogstashConfigFunc func(ctx context.Context, target string, configName string, content string) error
	RemoveLogstashConfigFunc func(ctx context.Context, target string, configName string) error
	RestartCollectorFunc     func(ctx context.Context, target string) error
	GetActiveCollectorsFunc  func(ctx context.Context) ([]string, map[string]bool, error)
	GetAllNetworkDeviceOrgsesFunc func(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error)
	GetAllNetworkDevicesFunc     func(ctx context.Context) ([]cloudhub.NetworkDevice, error)
	GetTotalShardsFunc           func(ctx context.Context) int
	GetShardIDFunc               func(deviceID string, totalShards int) int
	PushConfigUpdatesFunc        func(ctx context.Context, shardIDs []int)
	VerifyCollectorReadyFunc     func(ctx context.Context, collectorName string) error
	GenerateShardConfigFunc      func(ctx context.Context, shardID int) (string, error)
}

func (m *MockPlatform) GetAllNetworkDeviceOrgs(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
	if m.GetAllNetworkDeviceOrgsesFunc != nil {
		return m.GetAllNetworkDeviceOrgsesFunc(ctx)
	}
	return nil, nil
}

func (m *MockPlatform) GetAllNetworkDevices(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
	if m.GetAllNetworkDevicesFunc != nil {
		return m.GetAllNetworkDevicesFunc(ctx)
	}
	return nil, nil
}

func (m *MockPlatform) GenerateOrgConfig(ctx context.Context, org *cloudhub.NetworkDeviceOrg) (string, error) {
	// This mock is used as a ConfigGenerator for the platform manager in some cases.
	return "", nil
}

func (m *MockPlatform) DeployLogstashConfig(ctx context.Context, target string, configName string, content string) error {
	if m.DeployLogstashConfigFunc != nil {
		return m.DeployLogstashConfigFunc(ctx, target, configName, content)
	}
	return nil
}

func (m *MockPlatform) RemoveLogstashConfig(ctx context.Context, target string, configName string) error {
	if m.RemoveLogstashConfigFunc != nil {
		return m.RemoveLogstashConfigFunc(ctx, target, configName)
	}
	return nil
}

func (m *MockPlatform) RestartCollector(ctx context.Context, target string) error {
	if m.RestartCollectorFunc != nil {
		return m.RestartCollectorFunc(ctx, target)
	}
	return nil
}

func (m *MockPlatform) GetActiveCollectors(ctx context.Context) ([]string, map[string]bool, error) {
	if m.GetActiveCollectorsFunc != nil {
		return m.GetActiveCollectorsFunc(ctx)
	}
	return nil, nil, nil
}

func (m *MockPlatform) GetTotalShards(ctx context.Context) int {
	if m.GetTotalShardsFunc != nil {
		return m.GetTotalShardsFunc(ctx)
	}
	return 1
}

func (m *MockPlatform) GetShardID(deviceID string, totalShards int) int {
	if m.GetShardIDFunc != nil {
		return m.GetShardIDFunc(deviceID, totalShards)
	}
	return 0
}

func (m *MockPlatform) PushConfigUpdates(ctx context.Context, shardIDs []int) {
	if m.PushConfigUpdatesFunc != nil {
		m.PushConfigUpdatesFunc(ctx, shardIDs)
	}
}

func (m *MockPlatform) VerifyCollectorReady(ctx context.Context, collectorName string) error {
	if m.VerifyCollectorReadyFunc != nil {
		return m.VerifyCollectorReadyFunc(ctx, collectorName)
	}
	return nil
}

func (m *MockPlatform) GenerateShardConfig(ctx context.Context, shardID int) (string, error) {
	if m.GenerateShardConfigFunc != nil {
		return m.GenerateShardConfigFunc(ctx, shardID)
	}
	return "", nil
}
