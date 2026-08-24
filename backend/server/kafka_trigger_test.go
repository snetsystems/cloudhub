package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// MockKafkaProducer for trigger verification
type MockKafkaProducer struct {
	mu             sync.Mutex
	PublishCalls   []PublishCall
	NotifyChan     chan bool
	PartitionCount int
}

type PublishCall struct {
	ShardID int
	Config  string
}

func (m *MockKafkaProducer) PublishConfig(shardID int, configContent string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.PublishCalls = append(m.PublishCalls, PublishCall{
		ShardID: shardID,
		Config:  configContent,
	})
	if m.NotifyChan != nil {
		// Non-blocking send
		select {
		case m.NotifyChan <- true:
		default:
		}
	}
	return nil
}

func (m *MockKafkaProducer) Close() error {
	return nil
}

func (m *MockKafkaProducer) GetPartitionCount() (int, error) {
	if m.PartitionCount == 0 {
		return 1, nil
	}
	return m.PartitionCount, nil
}

func (m *MockKafkaProducer) GetCalls() []PublishCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.PublishCalls
}

func TestNetworkDevices_KafkaTrigger(t *testing.T) {
	logger := log.New(log.DebugLevel)
	mockKafka := &MockKafkaProducer{
		NotifyChan: make(chan bool, 10),
	}

	s := &Service{
		Store: &mocks.Store{
			OrganizationsStore: &mocks.OrganizationsStore{
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: *q.ID, Name: "TestOrg"}, nil
				},
			},
			NetworkDeviceStore: &mocks.NetworkDeviceStore{
				GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
					return &cloudhub.NetworkDevice{
						ID:           *q.ID,
						Organization: "76",
						DeviceIP:     "1.1.1.1",
					}, nil
				},
				UpdateF: func(ctx context.Context, dev *cloudhub.NetworkDevice) error { return nil },
				DeleteF: func(ctx context.Context, dev *cloudhub.NetworkDevice) error { return nil },
				AllF:    func(ctx context.Context) ([]cloudhub.NetworkDevice, error) { return []cloudhub.NetworkDevice{}, nil },
				AddF: func(ctx context.Context, dev *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {
					return dev, nil
				},
			},
			NetworkDeviceOrgStore: &mocks.NetworkDeviceOrgStore{
				GetF: func(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
					return &cloudhub.NetworkDeviceOrg{
						ID:                  *q.ID,
						CollectorServer:     "ch-collector-2",
						CollectedDevicesIDs: []string{},
					}, nil
				},
				AllF: func(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
					return []cloudhub.NetworkDeviceOrg{{ID: "76", CollectorServer: "ch-collector-2"}}, nil
				},
				UpdateF: func(ctx context.Context, org *cloudhub.NetworkDeviceOrg) error { return nil },
			},
			SourcesStore: MockSourcesStoreSetup(),
			MLNxRstStore: &mocks.MLNxRstStore{
				GetF: func(ctx context.Context, q cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error) { return nil, nil },
			},
			DLNxRstStore: &mocks.DLNxRstStore{
				GetF: func(ctx context.Context, q cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error) { return nil, nil },
			},
			DLNxRstStgStore: &mocks.DLNxRstStgStore{
				DeleteF: func(ctx context.Context, q cloudhub.DLNxRstStgQuery) error { return nil },
			},
		},
		Logger:        logger,
		KafkaProducer: mockKafka,
	}

	mockPlatform := &mocks.MockPlatform{
		GetTotalShardsFunc:       func(ctx context.Context) int { return 1 },
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		PushConfigUpdatesFunc: func(ctx context.Context, shardIDs []int) {
			// In tests, we manually bridge the platform call to our mock Kafka producer
			for _, sid := range shardIDs {
				org, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: ptr("76")})
				if org != nil {
					config, _ := s.GenerateOrgConfig(ctx, org)
					mockKafka.PublishConfig(sid, config)
				}
			}
		},
	}
	s.InternalENV.Platform = mockPlatform
	s.InternalENV.TemplatesManager = &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{
				Template: `{{define "input"}}{{end}}{{define "snmp_v3_input"}}{{end}}{{define "filter_ouput"}}{{end}}{{define "comment"}}{{end}}`,
			}, nil
		},
	}

	user := &cloudhub.User{Name: "test-user"}
	ctx := context.WithValue(context.Background(), UserContextKey, user)

	t.Run("MonitoringConfigManagement Trigger", func(t *testing.T) {
		mockKafka.mu.Lock()
		mockKafka.PublishCalls = nil
		mockKafka.mu.Unlock()

		w := httptest.NewRecorder()
		payload := map[string]interface{}{
			"collecting_devices": []map[string]interface{}{
				{"device_id": "958172376138104800", "is_collecting": true},
			},
		}
		buf, _ := json.Marshal(payload)
		r := httptest.NewRequest("POST", "/api/v1/collectors/monitoring/config", bytes.NewReader(buf))
		r = r.WithContext(ctx)
		s.MonitoringConfigManagement(w, r)

		select {
		case <-mockKafka.NotifyChan:
		case <-time.After(2 * time.Second):
			t.Errorf("Kafka trigger timed out for MonitoringConfigManagement")
		}
	})

	t.Run("LearningDeviceManagement Trigger", func(t *testing.T) {
		mockKafka.mu.Lock()
		mockKafka.PublishCalls = nil
		mockKafka.mu.Unlock()

		w := httptest.NewRecorder()
		payload := map[string]interface{}{
			"learning_devices": []map[string]interface{}{
				{"device_id": "958172376138104800", "is_learning": true},
			},
		}
		buf, _ := json.Marshal(payload)
		r := httptest.NewRequest("POST", "/api/v1/collectors/learning/devices", bytes.NewReader(buf))
		r = r.WithContext(ctx)
		s.LearningDeviceManagement(w, r)

		select {
		case <-mockKafka.NotifyChan:
		case <-time.After(2 * time.Second):
			t.Errorf("Kafka trigger timed out for LearningDeviceManagement")
		}
	})

	t.Run("RemoveDevices Trigger", func(t *testing.T) {
		mockKafka.mu.Lock()
		mockKafka.PublishCalls = nil
		mockKafka.mu.Unlock()

		w := httptest.NewRecorder()
		r := httptest.NewRequest("DELETE", "/api/v1/collectors/devices", strings.NewReader(`{"devices_ids": ["958172376138104800"]}`))
		r = r.WithContext(ctx)
		s.RemoveDevices(w, r)

		select {
		case <-mockKafka.NotifyChan:
		case <-time.After(2 * time.Second):
			t.Errorf("Kafka trigger timed out for RemoveDevices")
		}
	})
}
