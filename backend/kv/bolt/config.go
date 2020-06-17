package bolt

import (
	"context"
	"fmt"

	"github.com/boltdb/bolt"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/bolt/internal"
)

// Ensure ConfigStore implements cloudhub.ConfigStore.
var _ cloudhub.ConfigStore = &ConfigStore{}

// ConfigBucket is used to store CloudHub application state
var ConfigBucket = []byte("ConfigV1")

// configID is the boltDB key where the configuration object is stored
var configID = []byte("config/v1")

// ConfigStore uses bolt to store and retrieve global
// application configuration
type ConfigStore struct {
	client *Client
}

// Migrate ...
func (s *ConfigStore) Migrate(ctx context.Context) error {
	if _, err := s.Get(ctx); err != nil {
		return s.Initialize(ctx)
	}
	return nil
}

// Initialize ...
func (s *ConfigStore) Initialize(ctx context.Context) error {
	cfg := cloudhub.Config{
		Auth: cloudhub.AuthConfig{
			SuperAdminNewUsers: false,
		},
	}
	return s.Update(ctx, &cfg)
}

// Get ...
func (s *ConfigStore) Get(ctx context.Context) (*cloudhub.Config, error) {
	var cfg cloudhub.Config
	err := s.client.db.View(func(tx *bolt.Tx) error {
		v := tx.Bucket(ConfigBucket).Get(configID)
		if v == nil {
			return cloudhub.ErrConfigNotFound
		}
		return internal.UnmarshalConfig(v, &cfg)
	})

	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Update ...
func (s *ConfigStore) Update(ctx context.Context, cfg *cloudhub.Config) error {
	if cfg == nil {
		return fmt.Errorf("config provided was nil")
	}
	return s.client.db.Update(func(tx *bolt.Tx) error {
		if v, err := internal.MarshalConfig(cfg); err != nil {
			return err
		} else if err := tx.Bucket(ConfigBucket).Put(configID, v); err != nil {
			return err
		}
		return nil
	})
}

// All returns all known config
func (s *ConfigStore) All(ctx context.Context) ([]cloudhub.Config, error) {
	var orgs []cloudhub.Config
	err := s.each(ctx, func(o *cloudhub.Config) {
		orgs = append(orgs, *o)
	})

	if err != nil {
		return nil, err
	}

	return orgs, nil
}

func (s *ConfigStore) each(ctx context.Context, fn func(*cloudhub.Config)) error {
	return s.client.db.View(func(tx *bolt.Tx) error {
		return tx.Bucket(ConfigBucket).ForEach(func(k, v []byte) error {
			var cfg cloudhub.Config
			if err := internal.UnmarshalConfig(v, &cfg); err != nil {
				return err
			}
			fn(&cfg)
			return nil
		})
	})
}

