package kv

import (
	"context"
	"fmt"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure NetworkDeviceStore implements cloudhub.DeviceStore.
var _ cloudhub.NetworkDeviceStore = &NetworkDeviceStore{}

// NetworkDeviceStore is the bolt and etcd implementation of storing Devices.
type NetworkDeviceStore struct {
	client *Service
}

// Get searches the deviceStore for a Network Device with the given id.
func (s *NetworkDeviceStore) get(ctx context.Context, id string) (*cloudhub.NetworkDevice, error) {
	var device cloudhub.NetworkDevice
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(networkDeviceBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrDeviceNotFound
		}
		return internal.UnmarshalNetworkDevice(v, &device)
	})

	if err != nil {
		return nil, err
	}

	return &device, nil
}

// each iterates through all Devices in the deviceStore.
func (s *NetworkDeviceStore) each(ctx context.Context, fn func(*cloudhub.NetworkDevice)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(networkDeviceBucket).ForEach(func(k, v []byte) error {
			var device cloudhub.NetworkDevice
			if err := internal.UnmarshalNetworkDevice(v, &device); err != nil {
				return nil
			}
			fn(&device)
			return nil
		})
	})
}

// Get returns a Device if the id exists.
func (s *NetworkDeviceStore) Get(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	return nil, fmt.Errorf("must specify either ID in DeviceQuery")
}

// Add creates a new Device in the deviceStore.
func (s *NetworkDeviceStore) Add(ctx context.Context, device *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(networkDeviceBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}

		strID := strconv.FormatUint(seq, 10)
		device.ID = strID

		if v, err := internal.MarshalNetworkDevice(device); err != nil {
			return err
		} else if err := b.Put([]byte(strID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return device, nil
}

// Delete removes the Device from the deviceStore.
func (s *NetworkDeviceStore) Delete(ctx context.Context, device *cloudhub.NetworkDevice) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {

		_, err := s.get(ctx, device.ID)
		if err != nil {
			return cloudhub.ErrDeviceNotFound
		}

		if err := tx.Bucket(networkDeviceBucket).Delete([]byte(device.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Update modifies an existing Device in the deviceStore.
func (s *NetworkDeviceStore) Update(ctx context.Context, device *cloudhub.NetworkDevice) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		// Get an existing Device with the same ID.
		_, err := s.get(ctx, device.ID)
		if err != nil {
			return cloudhub.ErrDeviceNotFound
		}

		if v, err := internal.MarshalNetworkDevice(device); err != nil {
			return err
		} else if err := tx.Bucket(networkDeviceBucket).Put([]byte(device.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// All returns all known Devices.
func (s *NetworkDeviceStore) All(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
	var devices []cloudhub.NetworkDevice
	err := s.each(ctx, func(o *cloudhub.NetworkDevice) {
		devices = append(devices, *o)
	})

	if err != nil {
		return nil, err
	}

	return devices, nil
}

func (s *NetworkDeviceStore) DeleteAll(ctx context.Context) error {

	// Fetch all keys with the specified prefix
	var keys [][]byte
	err := s.client.kv.View(ctx, func(tx Tx) error {
		bucket := tx.Bucket(networkDeviceBucket)
		return bucket.ForEach(func(k, v []byte) error {
			keys = append(keys, k)
			return nil
		})
	})

	if err != nil {
		return fmt.Errorf("failed to get keys: %v", err)
	}

	err = s.client.kv.Update(ctx, func(tx Tx) error {
		bucket := tx.Bucket(networkDeviceBucket)
		for _, k := range keys {
			if err := bucket.Delete(k); err != nil {
				return fmt.Errorf("failed to delete key %s: %v", k, err)
			}
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to delete keys: %v", err)
	}

	return nil
}
