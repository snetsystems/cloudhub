package kv

import (
	"context"
	"fmt"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure topologiesStore implements cloudhub.TopologiesStore.
var _ cloudhub.TopologiesStore = &topologiesStore{}

// topologiesStore is the bolt implementation of storing topologies
type topologiesStore struct {
	client *Service
}

// All returns all known topologies
func (s *topologiesStore) All(ctx context.Context) ([]cloudhub.Topology, error) {
	var srcs []cloudhub.Topology
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		if err := tx.Bucket(topologyBucket).ForEach(func(k, v []byte) error {
			var src cloudhub.Topology
			if err := internal.UnmarshalTopology(v, &src); err != nil {
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

// Add creates a new topology in the topologiesStore
func (s *topologiesStore) Add(ctx context.Context, tp *cloudhub.Topology) (*cloudhub.Topology, error) {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(topologyBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		tp.ID = strconv.FormatUint(seq, 10)

		if v, err := internal.MarshalTopology(tp); err != nil {
			return err
		} else if err := b.Put([]byte(tp.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return tp, nil
}

// Get returns a topology if the id exists.
func (s *topologiesStore) Get(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	if q.Organization != nil {
		var tp *cloudhub.Topology
		err := s.each(ctx, func(t *cloudhub.Topology) {
			if tp != nil {
				return
			}
			if t.Organization == *q.Organization {
				tp = t
			}
		})

		if err != nil {
			return nil, err
		}

		if tp == nil {
			return nil, cloudhub.ErrTopologyNotFound
		}

		return tp, nil
	}

	return nil, fmt.Errorf("must specify either Organization in TopologyQuery")
}

// Delete the topology from topologiesStore
func (s *topologiesStore) Delete(ctx context.Context, tp *cloudhub.Topology) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		_, err := s.get(ctx, tp.ID)
		if err != nil {
			return cloudhub.ErrTopologyNotFound
		}

		if err := tx.Bucket(topologyBucket).Delete([]byte(tp.ID)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// Update the topology in topologiesStore
func (s *topologiesStore) Update(ctx context.Context, tp *cloudhub.Topology) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		// Get an existing topology with the same ID.
		_, err := s.get(ctx, tp.ID)
		if err != nil {
			return cloudhub.ErrTopologyNotFound
		}

		if v, err := internal.MarshalTopology(tp); err != nil {
			return err
		} else if err := tx.Bucket(topologyBucket).Put([]byte(tp.ID), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

// get searches the topologiesStore for topology with id and returns the bolt representation
func (s *topologiesStore) get(ctx context.Context, id string) (*cloudhub.Topology, error) {
	var tp cloudhub.Topology
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(topologyBucket).Get([]byte(id))
		if v == nil || err != nil {
			return cloudhub.ErrTopologyNotFound
		}
		return internal.UnmarshalTopology(v, &tp)
	})

	if err != nil {
		return nil, err
	}

	return &tp, nil
}

func (s *topologiesStore) each(ctx context.Context, fn func(*cloudhub.Topology)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(topologyBucket).ForEach(func(k, v []byte) error {
			var tp cloudhub.Topology
			if err := internal.UnmarshalTopology(v, &tp); err != nil {
				return err
			}
			fn(&tp)
			return nil
		})
	})
}