package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure URLMonitoringStore implements cloudhub.URLMonitoringStore at compile time.
var _ cloudhub.URLMonitoringStore = &URLMonitoringStore{}

// URLMonitoringStore is a no-op store used when PostgreSQL is not configured.
type URLMonitoringStore struct{}

func (s *URLMonitoringStore) All(context.Context) ([]cloudhub.URLMonitoring, error) {
	return nil, fmt.Errorf("no URLMonitoringStore configured")
}

func (s *URLMonitoringStore) Add(_ context.Context, _ *cloudhub.URLMonitoring) (*cloudhub.URLMonitoring, error) {
	return nil, fmt.Errorf("no URLMonitoringStore configured")
}

func (s *URLMonitoringStore) Get(_ context.Context, _ string) (*cloudhub.URLMonitoring, error) {
	return nil, cloudhub.ErrURLMonitoringNotFound
}

func (s *URLMonitoringStore) GetByID(_ context.Context, _ string) (*cloudhub.URLMonitoring, error) {
	return nil, cloudhub.ErrURLMonitoringNotFound
}

func (s *URLMonitoringStore) Update(_ context.Context, _ *cloudhub.URLMonitoring) (*cloudhub.URLMonitoring, error) {
	return nil, fmt.Errorf("no URLMonitoringStore configured")
}

func (s *URLMonitoringStore) Delete(_ context.Context, _ string) error {
	return fmt.Errorf("no URLMonitoringStore configured")
}
