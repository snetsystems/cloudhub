package k8s

import (
	"context"
	"errors"
	"testing"

	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

type MockKafkaProducerSharding struct {
	Count int
	Err   error
}

func (m *MockKafkaProducerSharding) PublishConfig(shardID int, configContent string) error {
	return nil
}

func (m *MockKafkaProducerSharding) GetPartitionCount() (int, error) {
	return m.Count, m.Err
}

func TestGetTotalShards_Priority(t *testing.T) {
	logger := &MockLogger{}

	tests := []struct {
		name           string
		kafkaCount     int
		kafkaErr       error
		maxShards      int
		expectedShards int
	}{
		{
			name:           "1. Priority: Kafka Partition Count",
			kafkaCount:     50,
			kafkaErr:       nil,
			maxShards:      20,
			expectedShards: 50,
		},
		{
			name:           "2. Fallback: MaxShards (Kafka Error)",
			kafkaCount:     0,
			kafkaErr:       errors.New("connection failed"),
			maxShards:      20,
			expectedShards: 20,
		},
		{
			name:           "3. Fallback: MaxShards (Kafka Count 0)",
			kafkaCount:     0,
			kafkaErr:       nil,
			maxShards:      30,
			expectedShards: 30,
		},
		{
			name:           "4. Fallback: Default 1 (Kafka Error + MaxShards 0 + No K8s Client)",
			kafkaCount:     0,
			kafkaErr:       errors.New("fail"),
			maxShards:      0,
			expectedShards: 1, // Final fallback if Kafka and MaxShards are unavailable
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kp := &MockKafkaProducerSharding{
				Count: tt.kafkaCount,
				Err:   tt.kafkaErr,
			}

			// Initialize Manager with dummy k8s client (simulating failure/no-connection for replicas)
			client := kubernetes.NewClient(kubernetes.Config{}, logger)
			mgr := NewManager(client, tt.maxShards, logger)
			mgr.KafkaProducer = kp

			shardCount := mgr.GetTotalShards(context.Background())

			if shardCount != tt.expectedShards {
				t.Errorf("expected %d shards, got %d", tt.expectedShards, shardCount)
			}
		})
	}
}
