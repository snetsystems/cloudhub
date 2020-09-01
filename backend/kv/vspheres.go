package kv

import (
	"context"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure vspheresStore implements cloudhub.VspheresStore.
var _ cloudhub.VspheresStore = &vspheresStore{}

// vspheresStore uses bolt to store and retrieve vspheres
type vspheresStore struct {
	client *Service
}

// All returns all known vspheres
func (s *vspheresStore) All(ctx context.Context) ([]cloudhub.Vsphere, error) {
	var vss []cloudhub.Vsphere
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(vSpheresBucket).ForEach(func(k, v []byte) error {
			var vs cloudhub.Vsphere
			if err := internal.UnmarshalVsphere(v, &vs); err != nil {
				return err
			}
			vss = append(vss, vs)
			return nil
		})
	}); err != nil {
		return nil, err
	}

	return vss, nil
}

// Add creates a new vsphere in the vspheresStore.
func (s *vspheresStore) Add(ctx context.Context, vs cloudhub.Vsphere) (cloudhub.Vsphere, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(vSpheresBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		vs.ID = strconv.FormatUint(seq, 10)

		if v, err := internal.MarshalVsphere(vs); err != nil {
			return err
		} else if err := b.Put([]byte(vs.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cloudhub.Vsphere{}, err
	}

	return vs, nil
}

// Delete removes the vsphere from the vspheresStore
func (s *vspheresStore) Delete(ctx context.Context, vs cloudhub.Vsphere) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		if err := tx.Bucket(vSpheresBucket).Delete([]byte(vs.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Get returns a vsphere if the id exists.
func (s *vspheresStore) Get(ctx context.Context, id string) (cloudhub.Vsphere, error) {
	var vs cloudhub.Vsphere
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		if v, err := tx.Bucket(vSpheresBucket).Get([]byte(id)); v == nil || err != nil {
			return cloudhub.ErrVsphereNotFound
		} else if err := internal.UnmarshalVsphere(v, &vs); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cloudhub.Vsphere{}, err
	}

	return vs, nil
}

// Update a vsphere
func (s *vspheresStore) Update(ctx context.Context, vs cloudhub.Vsphere) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		// Get an existing vsphere with the same ID.
		b := tx.Bucket(vSpheresBucket)
		if v, err := b.Get([]byte(vs.ID)); v == nil || err != nil {
			return cloudhub.ErrVsphereNotFound
		}

		if v, err := internal.MarshalVsphere(vs); err != nil {
			return err
		} else if err := b.Put([]byte(vs.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}