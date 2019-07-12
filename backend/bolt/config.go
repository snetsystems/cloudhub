package bolt

import (
	"context"
	"fmt"

	"github.com/boltdb/bolt"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/bolt/internal"
)

// Ensure ConfigStore implements cmp.ConfigStore.
var _ cmp.ConfigStore = &ConfigStore{}

// ConfigBucket is used to store CMP application state
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
	cfg := cmp.Config{
		Auth: cmp.AuthConfig{
			SuperAdminNewUsers: false,
		},
	}
	return s.Update(ctx, &cfg)
}

// Get ...
func (s *ConfigStore) Get(ctx context.Context) (*cmp.Config, error) {
	var cfg cmp.Config
	err := s.client.db.View(func(tx *bolt.Tx) error {
		v := tx.Bucket(ConfigBucket).Get(configID)
		if v == nil {
			return cmp.ErrConfigNotFound
		}
		return internal.UnmarshalConfig(v, &cfg)
	})

	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Update ...
func (s *ConfigStore) Update(ctx context.Context, cfg *cmp.Config) error {
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
