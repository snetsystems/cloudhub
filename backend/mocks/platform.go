package mocks

import (
	"context"
)

// MockPlatform is a mock implementation of the Platform interface for testing.
type MockPlatform struct {
	DeployLogstashConfigFunc func(ctx context.Context, target string, configName string, content string) error
	RemoveLogstashConfigFunc func(ctx context.Context, target string, configName string) error
	RestartCollectorFunc     func(ctx context.Context, target string) error
	GetActiveCollectorsFunc  func(ctx context.Context) ([]string, map[string]bool, error)
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
