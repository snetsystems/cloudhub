package kv

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure sourcesStore implements cloudhub.SourcesStore.
var _ cloudhub.EsSourcesStore = &esSourcesStore{}

// sourcesStore is a bolt implementation to store time-series source information.
type esSourcesStore struct {
	client *Service
}

// All returns all known sources
func (s *esSourcesStore) All(ctx context.Context) ([]cloudhub.EsSource, error) {
	var srcs []cloudhub.EsSource
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		var err error
		srcs, err = s.all(ctx, tx)
		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return srcs, nil

}

// Add creates a new EsSource in the SourceStore.
func (s *esSourcesStore) Add(ctx context.Context, src cloudhub.EsSource) (cloudhub.EsSource, error) {
	// force first source added to be default
	if srcs, err := s.All(ctx); err != nil {
		return cloudhub.EsSource{}, err
	} else if len(srcs) == 0 {
		src.Default = true
	}

	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		return s.add(ctx, &src, tx)
	}); err != nil {
		return cloudhub.EsSource{}, err
	}

	return src, nil
}

// Delete removes the EsSource from the sourcesStore
func (s *esSourcesStore) Delete(ctx context.Context, src cloudhub.EsSource) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		if err := s.setRandomDefault(ctx, src, tx); err != nil {
			return err
		}
		return s.delete(ctx, src, tx)
	}); err != nil {
		return err
	}

	return nil
}

// Get returns a EsSource if the id exists.
func (s *esSourcesStore) Get(ctx context.Context, id int) (cloudhub.EsSource, error) {
	var src cloudhub.EsSource
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		var err error
		src, err = s.get(ctx, id, tx)
		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return cloudhub.EsSource{}, err
	}

	return src, nil
}

// Update a EsSource
func (s *esSourcesStore) Update(ctx context.Context, src cloudhub.EsSource) error {
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		return s.update(ctx, src, tx)
	}); err != nil {
		return err
	}

	return nil
}

func (s *esSourcesStore) all(_ context.Context, tx Tx) ([]cloudhub.EsSource, error) {
	var srcs []cloudhub.EsSource
	if err := tx.Bucket(esSourcesBucket).ForEach(func(k, v []byte) error {
		var src cloudhub.EsSource
		if err := internal.UnmarshalEsSource(v, &src); err != nil {
			return err
		}
		srcs = append(srcs, src)
		return nil
	}); err != nil {
		return srcs, err
	}
	return srcs, nil
}

func (s *esSourcesStore) add(ctx context.Context, src *cloudhub.EsSource, tx Tx) error {
	b := tx.Bucket(esSourcesBucket)
	seq, err := b.NextSequence()
	if err != nil {
		return err
	}
	src.ID = int(seq)

	if src.Default {
		if err := s.resetDefaultSource(ctx, tx); err != nil {
			return err
		}
	}

	if v, err := internal.MarshalEsSource(*src); err != nil {
		return err
	} else if err := b.Put(itob(src.ID), v); err != nil {
		return err
	}
	return nil
}

func (s *esSourcesStore) delete(_ context.Context, src cloudhub.EsSource, tx Tx) error {
	if err := tx.Bucket(esSourcesBucket).Delete(itob(src.ID)); err != nil {
		return err
	}
	return nil
}

func (s *esSourcesStore) get(_ context.Context, id int, tx Tx) (cloudhub.EsSource, error) {
	var src cloudhub.EsSource
	if v, err := tx.Bucket(esSourcesBucket).Get(itob(id)); v == nil || err != nil {
		return src, cloudhub.ErrSourceNotFound
	} else if err := internal.UnmarshalEsSource(v, &src); err != nil {
		return src, err
	}
	return src, nil
}

func (s *esSourcesStore) update(ctx context.Context, src cloudhub.EsSource, tx Tx) error {
	// Get an existing soource with the same ID.
	b := tx.Bucket(esSourcesBucket)
	if v, err := b.Get(itob(src.ID)); v == nil || err != nil {
		return cloudhub.ErrSourceNotFound
	}

	if src.Default {
		if err := s.resetDefaultSource(ctx, tx); err != nil {
			return err
		}
	}

	if v, err := internal.MarshalEsSource(src); err != nil {
		return err
	} else if err := b.Put(itob(src.ID), v); err != nil {
		return err
	}
	return nil
}

// resetDefaultSource unsets the Default flag on all sources
func (s *esSourcesStore) resetDefaultSource(ctx context.Context, tx Tx) error {
	b := tx.Bucket(esSourcesBucket)
	srcs, err := s.all(ctx, tx)
	if err != nil {
		return err
	}

	for _, other := range srcs {
		if other.Default {
			other.Default = false
			if v, err := internal.MarshalEsSource(other); err != nil {
				return err
			} else if err := b.Put(itob(other.ID), v); err != nil {
				return err
			}
		}
	}
	return nil
}

// setRandomDefault will locate a source other than the provided
// cloudhub.EsSource and set it as the default source. If no other sources are
// available, the provided source will be set to the default source if is not
// already. It assumes that the provided cloudhub.EsSource has been persisted.
func (s *esSourcesStore) setRandomDefault(ctx context.Context, src cloudhub.EsSource, tx Tx) error {
	// Check if requested source is the current default
	if target, err := s.get(ctx, src.ID, tx); err != nil {
		return err
	} else if target.Default {
		// Locate another source to be the new default
		srcs, err := s.all(ctx, tx)
		if err != nil {
			return err
		}
		var other *cloudhub.EsSource
		for idx := range srcs {
			other = &srcs[idx]
			// avoid selecting the source we're about to delete as the new default
			if other.ID != target.ID {
				break
			}
		}

		// set the other to be the default
		other.Default = true
		if err := s.update(ctx, *other, tx); err != nil {
			return err
		}
	}
	return nil
}
