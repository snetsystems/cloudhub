package kv

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure organizationConfigStore implements cloudhub.OrganizationConfigStore.
var _ cloudhub.OrganizationConfigStore = &organizationConfigStore{}

// organizationConfigStore uses a kv to store and retrieve organization configurations.
type organizationConfigStore struct {
	client *Service
}

func (s *organizationConfigStore) get(ctx context.Context, tx Tx, orgID string, c *cloudhub.OrganizationConfig) error {
	v, err := tx.Bucket(organizationConfigBucket).Get([]byte(orgID))
	if len(v) == 0 || err != nil {
		return cloudhub.ErrOrganizationConfigNotFound
	}
	return internal.UnmarshalOrganizationConfig(v, c)
}

// FindOrCreate gets an OrganizationConfig from the store or creates one if none exists for this organization
func (s *organizationConfigStore) FindOrCreate(ctx context.Context, orgID string) (*cloudhub.OrganizationConfig, error) {
	var c cloudhub.OrganizationConfig
	err := s.client.kv.Update(ctx, func(tx Tx) error {
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
func (s *organizationConfigStore) Put(ctx context.Context, c *cloudhub.OrganizationConfig) error {
	return s.client.kv.Update(ctx, func(tx Tx) error {
		return s.put(ctx, tx, c)
	})
}

func (s *organizationConfigStore) put(ctx context.Context, tx Tx, c *cloudhub.OrganizationConfig) error {
	if c == nil {
		return fmt.Errorf("config provided was nil")
	}
	if v, err := internal.MarshalOrganizationConfig(c); err != nil {
		return err
	} else if err := tx.Bucket(organizationConfigBucket).Put([]byte(c.OrganizationID), v); err != nil {
		return err
	}
	return nil
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

// All returns all known organizationConfigs
func (s *organizationConfigStore) All(ctx context.Context) ([]cloudhub.OrganizationConfig, error) {
	var orgCfgs []cloudhub.OrganizationConfig
	err := s.each(ctx, func(o *cloudhub.OrganizationConfig) {
		orgCfgs = append(orgCfgs, *o)
	})

	if err != nil {
		return nil, err
	}

	return orgCfgs, nil
}

func (s *organizationConfigStore) each(ctx context.Context, fn func(*cloudhub.OrganizationConfig)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(organizationConfigBucket).ForEach(func(k, v []byte) error {
			var orgCfg cloudhub.OrganizationConfig
			if err := internal.UnmarshalOrganizationConfig(v, &orgCfg); err != nil {
				return err
			}
			fn(&orgCfg)
			return nil
		})
	})
}

