package kafka

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/IBM/sarama"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ConfigProducer wraps the sarama SyncProducer for CloudHub configuration updates
type ConfigProducer struct {
	client   sarama.Client
	producer sarama.SyncProducer
	topic    string
}

// NewConfigProducer initializes a new ConfigProducer
func NewConfigProducer(brokers []string, topic string) (*ConfigProducer, error) {
	if len(brokers) == 0 {
		return nil, nil // No brokers configured, running in HTTP-only mode
	}

	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	config.Producer.RequiredAcks = sarama.WaitForAll // Wait for all replicas
	config.Producer.Retry.Max = 5

	client, err := sarama.NewClient(brokers, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka client: %w", err)
	}

	producer, err := sarama.NewSyncProducerFromClient(client)
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to create kafka producer: %w", err)
	}

	return &ConfigProducer{
		client:   client,
		producer: producer,
		topic:    topic,
	}, nil
}

// Close closes the producer and client
func (p *ConfigProducer) Close() error {
	if p == nil {
		return nil
	}
	if p.producer != nil {
		if err := p.producer.Close(); err != nil {
			return err
		}
	}
	if p.client != nil {
		if err := p.client.Close(); err != nil {
			return err
		}
	}
	return nil
}

// GetPartitionCount returns the number of partitions for the configured topic
func (p *ConfigProducer) GetPartitionCount() (int, error) {
	if p == nil || p.client == nil {
		return 0, cloudhub.ErrKafkaPartitionCountFetchFailed
	}
	partitions, err := p.client.Partitions(p.topic)
	if err != nil {
		return 0, err
	}
	return len(partitions), nil
}

// PublishConfig publishes a configuration update for a specific shard
func (p *ConfigProducer) PublishConfig(shardID int, configContent string) error {
	if p == nil || p.producer == nil {
		return nil // implementation choice: strictly optional enhancement, don't error if kafka not configured
	}

	key := fmt.Sprintf("shard-%d", shardID)

	// Message payload structure
	messageVal := map[string]interface{}{
		"shard_id":  shardID,
		"config":    configContent,
		"timestamp": time.Now().Unix(),
		"version":   "1.0",
	}

	valueBytes, err := json.Marshal(messageVal)
	if err != nil {
		return fmt.Errorf("failed to marshal config message: %w", err)
	}

	msg := &sarama.ProducerMessage{
		Topic: p.topic,
		Key:   sarama.StringEncoder(key),
		Value: sarama.ByteEncoder(valueBytes),
		Headers: []sarama.RecordHeader{
			{
				Key:   []byte("content-type"),
				Value: []byte("application/json"),
			},
		},
	}

	_, _, err = p.producer.SendMessage(msg)
	if err != nil {
		return fmt.Errorf("%w: %v", cloudhub.ErrKafkaPublishFailed, err)
	}

	return nil
}
