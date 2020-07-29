package kv

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure configStore implements cloudhub.ConfigStore.
var _ cloudhub.ConfigStore = &configStore{}

// configID is the boltDB key where the configuration object is stored
var configID = []byte("config/v1")

// ConfigStore uses bolt to store and retrieve global
// application configuration
type configStore struct {
	client *Service
}

func (s *configStore) Get(ctx context.Context) (*cloudhub.Config, error) {
	var cfg cloudhub.Config
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(configBucket).Get(configID)
		if v == nil || err != nil {
			cfg = cloudhub.Config{
				Auth: cloudhub.AuthConfig{
					SuperAdminNewUsers: false,
				},
			}
			return nil
		}
		return internal.UnmarshalConfig(v, &cfg)
	})
	return &cfg, err
}

func (s *configStore) Update(ctx context.Context, cfg *cloudhub.Config) error {
	if cfg == nil {
		return fmt.Errorf("config provided was nil")
	}
	return s.client.kv.Update(ctx, func(tx Tx) error {
		if v, err := internal.MarshalConfig(cfg); err != nil {
			return err
		} else if err := tx.Bucket(configBucket).Put(configID, v); err != nil {
			return err
		}
		return nil
	})
}

// All returns all known configs
func (s *configStore) All(ctx context.Context) ([]cloudhub.Config, error) {
	var orgs []cloudhub.Config
	err := s.each(ctx, func(o *cloudhub.Config) {
		orgs = append(orgs, *o)
	})

	if err != nil {
		return nil, err
	}

	return orgs, nil
}

func (s *configStore) each(ctx context.Context, fn func(*cloudhub.Config)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(configBucket).ForEach(func(k, v []byte) error {
			var cfg cloudhub.Config
			if err := internal.UnmarshalConfig(v, &cfg); err != nil {
				return err
			}
			fn(&cfg)
			return nil
		})
	})
}
