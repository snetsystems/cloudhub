package kv

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure NetworkDeviceOrgStore implements cloudhub.NetworkDeviceOrgStore.
var _ cloudhub.NetworkDeviceOrgStore = &NetworkDeviceOrgStore{}

// NetworkDeviceOrgStore is the bolt and etcd implementation of storing Devices.
type NetworkDeviceOrgStore struct {
	client *Service
}

// Add creates a new Device in the deviceStore
func (s *NetworkDeviceOrgStore) Add(ctx context.Context, org *cloudhub.NetworkDeviceOrg, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(networkDeviceOrgBucket)

		if q.ID == nil {
			return fmt.Errorf("must specify either ID in Network Device Org Query")
		}

		if v, err := internal.MarshalNetworkDeviceOrg(org); err != nil {
			return err
		} else if err := b.Put([]byte(*q.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return org, nil
}

// Get returns a Device if the id exists.
func (s *NetworkDeviceOrgStore) Get(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	return nil, fmt.Errorf("must specify either ID in Network Device Org Query")
}

// Get searches the deviceStore for a Network Device with the given organization id.
func (s *NetworkDeviceOrgStore) get(ctx context.Context, id string) (*cloudhub.NetworkDeviceOrg, error) {
	var org cloudhub.NetworkDeviceOrg
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(networkDeviceOrgBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrDeviceNotFound
		}
		return internal.UnmarshalNetworkDeviceOrg(v, &org)
	})

	if err != nil {
		return nil, err
	}

	return &org, nil
}

// Delete removes the Device from the deviceStore.
func (s *NetworkDeviceOrgStore) Delete(ctx context.Context, org *cloudhub.NetworkDeviceOrg, q cloudhub.NetworkDeviceOrgQuery) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		if q.ID == nil {
			return fmt.Errorf("must specify either ID in Network Device Org Query")
		}
		_, err := s.get(ctx, *q.ID)
		if err != nil {
			return cloudhub.ErrDeviceNotFound
		}

		if err := tx.Bucket(networkDeviceOrgBucket).Delete([]byte(*q.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Update modifies an existing Device in the deviceStore.
func (s *NetworkDeviceOrgStore) Update(ctx context.Context, org *cloudhub.NetworkDeviceOrg, q cloudhub.NetworkDeviceOrgQuery) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		if q.ID == nil {
			return fmt.Errorf("must specify either ID in Network Device Org Query")
		}
		// Get an existing Device with the same ID.
		_, err := s.get(ctx, *q.ID)
		if err != nil {
			return cloudhub.ErrDeviceNotFound
		}

		if v, err := internal.MarshalNetworkDeviceOrg(org); err != nil {
			return err
		} else if err := tx.Bucket(networkDeviceOrgBucket).Put([]byte(*q.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// All returns all known Network Device Groups.
func (s *NetworkDeviceOrgStore) All(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) ([]cloudhub.NetworkDeviceOrg, error) {
	var orgs []cloudhub.NetworkDeviceOrg
	err := s.each(ctx, func(o *cloudhub.NetworkDeviceOrg) {
		orgs = append(orgs, *o)
	})

	if err != nil {
		return nil, err
	}

	return orgs, nil
}

// each iterates through all Network Device Organization in the Network Device Org.
func (s *NetworkDeviceOrgStore) each(ctx context.Context, fn func(*cloudhub.NetworkDeviceOrg)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(networkDeviceOrgBucket).ForEach(func(k, v []byte) error {
			var org cloudhub.NetworkDeviceOrg
			if err := internal.UnmarshalNetworkDeviceOrg(v, &org); err != nil {
				return err
			}
			fn(&org)
			return nil
		})
	})
}
