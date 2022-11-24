package kv

import (
	"context"
	"fmt"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure cspStore implements cloudhub.CSPStore.
var _ cloudhub.CSPStore = &cspStore{}

// cspStore is the bolt and etcd implementation of storing CSP
type cspStore struct {
	client *Service
}

// Add creates a new CSP in the cspStore
func (s *cspStore) Add(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(cspBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		csp.ID = strconv.FormatUint(seq, 10)

		if v, err := internal.MarshalCSP(csp); err != nil {
			return err
		} else if err := b.Put([]byte(csp.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return csp, nil
}

// Get returns a CSP if the id exists.
func (s *cspStore) Get(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	return nil, fmt.Errorf("must specify either Organization in CSPQuery")
}

// get searches the cspStore for CSP with id and returns the bolt representation
func (s *cspStore) get(ctx context.Context, id string) (*cloudhub.CSP, error) {
	var csp cloudhub.CSP
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(cspBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrCSPNotFound
		}
		return internal.UnmarshalCSP(v, &csp)
	})

	if err != nil {
		return nil, err
	}

	return &csp, nil
}

// Delete the CSP from cspStore
func (s *cspStore) Delete(ctx context.Context, csp *cloudhub.CSP) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		_, err := s.get(ctx, csp.ID)
		if err != nil {
			return cloudhub.ErrCSPNotFound
		}

		if err := tx.Bucket(cspBucket).Delete([]byte(csp.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Update the CSP in cspStore
func (s *cspStore) Update(ctx context.Context, csp *cloudhub.CSP) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		// Get an existing CSP with the same ID.
		_, err := s.get(ctx, csp.ID)
		if err != nil {
			return cloudhub.ErrCSPNotFound
		}

		if v, err := internal.MarshalCSP(csp); err != nil {
			return err
		} else if err := tx.Bucket(cspBucket).Put([]byte(csp.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// All returns all known CSP
func (s *cspStore) All(ctx context.Context) ([]cloudhub.CSP, error) {
	var csps []cloudhub.CSP
	err := s.each(ctx, func(o *cloudhub.CSP) {
		csps = append(csps, *o)
	})

	if err != nil {
		return nil, err
	}

	return csps, nil
}

func (s *cspStore) each(ctx context.Context, fn func(*cloudhub.CSP)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(cspBucket).ForEach(func(k, v []byte) error {
			var csp cloudhub.CSP
			if err := internal.UnmarshalCSP(v, &csp); err != nil {
				return err
			}
			fn(&csp)
			return nil
		})
	})
}
