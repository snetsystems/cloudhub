package bolt

import (
	"context"
	"fmt"

	"github.com/boltdb/bolt"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/bolt/internal"
)

// Ensure OrganizationConfigStore implements cmp.OrganizationConfigStore.
var _ cmp.OrganizationConfigStore = &OrganizationConfigStore{}

// OrganizationConfigBucket is used to store cmp organization configurations
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
func (s *OrganizationConfigStore) Get(ctx context.Context, orgID string) (*cmp.OrganizationConfig, error) {
	var c cmp.OrganizationConfig

	err := s.client.db.View(func(tx *bolt.Tx) error {
		return s.get(ctx, tx, orgID, &c)
	})

	if err != nil {
		return nil, err
	}

	return &c, nil
}

func (s *OrganizationConfigStore) get(ctx context.Context, tx *bolt.Tx, orgID string, c *cmp.OrganizationConfig) error {
	v := tx.Bucket(OrganizationConfigBucket).Get([]byte(orgID))
	if len(v) == 0 {
		return cmp.ErrOrganizationConfigNotFound
	}
	return internal.UnmarshalOrganizationConfig(v, c)
}

// FindOrCreate gets an OrganizationConfig from the store or creates one if none exists for this organization
func (s *OrganizationConfigStore) FindOrCreate(ctx context.Context, orgID string) (*cmp.OrganizationConfig, error) {
	var c cmp.OrganizationConfig
	err := s.client.db.Update(func(tx *bolt.Tx) error {
		err := s.get(ctx, tx, orgID, &c)
		if err == cmp.ErrOrganizationConfigNotFound {
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
func (s *OrganizationConfigStore) Put(ctx context.Context, c *cmp.OrganizationConfig) error {
	return s.client.db.Update(func(tx *bolt.Tx) error {
		return s.put(ctx, tx, c)
	})
}

func (s *OrganizationConfigStore) put(ctx context.Context, tx *bolt.Tx, c *cmp.OrganizationConfig) error {
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

func newOrganizationConfig(orgID string) cmp.OrganizationConfig {
	return cmp.OrganizationConfig{
		OrganizationID: orgID,
		LogViewer: cmp.LogViewerConfig{
			Columns: []cmp.LogViewerColumn{
				{
					Name:     "time",
					Position: 0,
					Encodings: []cmp.ColumnEncoding{
						{
							Type:  "visibility",
							Value: "hidden",
						},
					},
				},
				{
					Name:     "severity",
					Position: 1,
					Encodings: []cmp.ColumnEncoding{

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
					Encodings: []cmp.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "message",
					Position: 3,
					Encodings: []cmp.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "facility",
					Position: 4,
					Encodings: []cmp.ColumnEncoding{

						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "procid",
					Position: 5,
					Encodings: []cmp.ColumnEncoding{

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
					Encodings: []cmp.ColumnEncoding{
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
					Encodings: []cmp.ColumnEncoding{
						{
							Type:  "visibility",
							Value: "visible",
						},
					},
				},
				{
					Name:     "host",
					Position: 8,
					Encodings: []cmp.ColumnEncoding{
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
