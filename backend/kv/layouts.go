package kv

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure layoutsStore implements cloudhub.LayoutsStore.
var _ cloudhub.LayoutsStore = &layoutsStore{}

// layoutsStore is the implementation to store layouts.
type layoutsStore struct {
	client *Service
	IDs    cloudhub.ID
}

// All returns all known layouts
func (s *layoutsStore) All(ctx context.Context) ([]cloudhub.Layout, error) {
	var srcs []cloudhub.Layout
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		if err := tx.Bucket(layoutsBucket).ForEach(func(k, v []byte) error {
			var src cloudhub.Layout
			if err := internal.UnmarshalLayout(v, &src); err != nil {
				return err
			}
			srcs = append(srcs, src)
			return nil
		}); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return srcs, nil

}

// Get returns a Layout if the id exists.
func (s *layoutsStore) Get(ctx context.Context, id string) (cloudhub.Layout, error) {
	var src cloudhub.Layout
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		if v, err := tx.Bucket(layoutsBucket).Get([]byte(id)); v == nil || err != nil {
			return cloudhub.ErrLayoutNotFound
		} else if err := internal.UnmarshalLayout(v, &src); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cloudhub.Layout{}, err
	}

	return src, nil
}
