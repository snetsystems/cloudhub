package bolt

import (
	"context"
	"fmt"

	"github.com/boltdb/bolt"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/bolt/internal"
)

// Ensure OrganizationConfigStore implements cloudhub.OrganizationConfigStore.
var _ cloudhub.OrganizationConfigStore = &OrganizationConfigStore{}

// OrganizationConfigBucket is used to store cloudhub organization configurations
var OrganizationConfigBucket = []byte("OrganizationConfigV1")

// OrganizationConfigStore uses bolt to store and retrieve organization configurations
type OrganizationConfigStore struct {
	client *Client
}

// Migrate ...
func (s *OrganizationConfigStore) Migrate(ctx context.Context) error {
	return nil
}

// Get retrieves an OrganizationConfig from the store
func (s *OrganizationConfigStore) Get(ctx context.Context, orgID string) (*cloudhub.OrganizationConfig, error) {
	var c cloudhub.OrganizationConfig

	err := s.client.db.View(func(tx *bolt.Tx) error {
		return s.get(ctx, tx, orgID, &c)
	})

	if err != nil {
		return nil, err
	}

	return &c, nil
}

func (s *OrganizationConfigStore) get(ctx context.Context, tx *bolt.Tx, orgID string, c *cloudhub.OrganizationConfig) error {
	v := tx.Bucket(OrganizationConfigBucket).Get([]byte(orgID))
	if len(v) == 0 {
		return cloudhub.ErrOrganizationConfigNotFound
	}
	return internal.UnmarshalOrganizationConfig(v, c)
}

// FindOrCreate gets an OrganizationConfig from the store or creates one if none exists for this organization
func (s *OrganizationConfigStore) FindOrCreate(ctx context.Context, orgID string) (*cloudhub.OrganizationConfig, error) {
	var c cloudhub.OrganizationConfig
	err := s.client.db.Update(func(tx *bolt.Tx) error {
		err := s.get(ctx, tx, orgID, &c)
		if err == cloudhub.ErrOrganizationConfigNotFound {
			c = newOrganizationConfig(orgID)
			return s.put(ctx, tx, &c)
		}
		return err
	})

	if err != nil {
		return nil, err
	}
	return &c, nil
}

// Put replaces the OrganizationConfig in the store
func (s *OrganizationConfigStore) Put(ctx context.Context, c *cloudhub.OrganizationConfig) error {
	return s.client.db.Update(func(tx *bolt.Tx) error {
		return s.put(ctx, tx, c)
	})
}

func (s *OrganizationConfigStore) put(ctx context.Context, tx *bolt.Tx, c *cloudhub.OrganizationConfig) error {
	if c == nil {
		return fmt.Errorf("config provided was nil")
	}
	if v, err := internal.MarshalOrganizationConfig(c); err != nil {
		return err
	} else if err := tx.Bucket(OrganizationConfigBucket).Put([]byte(c.OrganizationID), v); err != nil {
		return err
	}
	return nil
}

// All returns all known OrganizationConfig
func (s *OrganizationConfigStore) All(ctx context.Context) ([]cloudhub.OrganizationConfig, error) {
	var orgs []cloudhub.OrganizationConfig
	err := s.each(ctx, func(o *cloudhub.OrganizationConfig) {
		orgs = append(orgs, *o)
	})

	if err != nil {
		return nil, err
	}

	return orgs, nil
}

func (s *OrganizationConfigStore) each(ctx context.Context, fn func(*cloudhub.OrganizationConfig)) error {
	return s.client.db.View(func(tx *bolt.Tx) error {
		return tx.Bucket(OrganizationConfigBucket).ForEach(func(k, v []byte) error {
			var orgCfg cloudhub.OrganizationConfig
			if err := internal.UnmarshalOrganizationConfig(v, &orgCfg); err != nil {
				return err
			}
			fn(&orgCfg)
			return nil
		})
	})
}

func newOrganizationConfig(orgID string) cloudhub.OrganizationConfig {
	return cloudhub.OrganizationConfig{
		OrganizationID: orgID,
		LogViewer: cloudhub.LogViewerConfig{
			Columns: []cloudhub.LogViewerColumn{
				{
					Name:     "time",
					Position: 0,
					Encodings: []cloudhub.ColumnEncoding{
						{
							Type:  "visibility",
							Value: "hidden",
						},
					},
				},
				{
					Name:     "severity",
					Position: 1,
					Encodings: []cloudhub.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
						{
							Type:  "label",
							Value: "icon",
						},
						{
							Type:  "label",
							Value: "text",
						},
						{
							Type:  "color",
							Name:  "emerg",
							Value: "ruby",
						},
						{
							Type:  "color",
							Name:  "alert",
							Value: "fire",
						},
						{
							Type:  "color",
							Name:  "crit",
							Value: "curacao",
						},
						{
							Type:  "color",
							Name:  "err",
							Value: "tiger",
						},
						{
							Type:  "color",
							Name:  "warning",
							Value: "pineapple",
						},
						{
							Type:  "color",
							Name:  "notice",
							Value: "rainforest",
						},
						{
							Type:  "color",
							Name:  "info",
							Value: "star",
						},
						{
							Type:  "color",
							Name:  "debug",
							Value: "wolf",
						},
					},
				},
				{
					Name:     "timestamp",
					Position: 2,
					Encodings: []cloudhub.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "message",
					Position: 3,
					Encodings: []cloudhub.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "facility",
					Position: 4,
					Encodings: []cloudhub.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "procid",
					Position: 5,
					Encodings: []cloudhub.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
						{
							Type:  "displayName",
							Value: "Proc ID",
						},
					},
				},
				{
					Name:     "appname",
					Position: 6,
					Encodings: []cloudhub.ColumnEncoding{
						{
							Type:  "visibility",
							Value: "visible",
						},
						{
							Type:  "displayName",
							Value: "Application",
						},
					},
				},
				{
					Name:     "hostname",
					Position: 7,
					Encodings: []cloudhub.ColumnEncoding{
						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "host",
					Position: 8,
					Encodings: []cloudhub.ColumnEncoding{
						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
			},
		},
	}
}
