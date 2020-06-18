package kv

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure usersStore implements cloudhub.UsersStore.
var _ cloudhub.UsersStore = &usersStore{}

// usersStore uses bolt to store and retrieve users
type usersStore struct {
	client *Service
}

// get searches the usersStore for user with id and returns the bolt representation
func (s *usersStore) get(ctx context.Context, id uint64) (*cloudhub.User, error) {
	var u cloudhub.User
	err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(usersBucket).Get(u64tob(id))
		if v == nil || err != nil {
			return cloudhub.ErrUserNotFound
		}
		return internal.UnmarshalUser(v, &u)
	})

	if err != nil {
		return nil, err
	}

	return &u, nil
}

func (s *usersStore) each(ctx context.Context, fn func(*cloudhub.User)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(usersBucket).ForEach(func(k, v []byte) error {
			var user cloudhub.User
			if err := internal.UnmarshalUser(v, &user); err != nil {
				return err
			}
			fn(&user)
			return nil
		})
	})
}

// Num returns the number of users in the usersStore
func (s *usersStore) Num(ctx context.Context) (int, error) {
	count := 0

	err := s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(usersBucket).ForEach(func(k, v []byte) error {
			count++
			return nil
		})
	})

	if err != nil {
		return 0, err
	}

	return count, nil
}

// Get searches the usersStore for user with name
func (s *usersStore) Get(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
	if q.ID != nil {
		return s.get(ctx, *q.ID)
	}

	if q.Name != nil && q.Provider != nil && q.Scheme != nil {
		var user *cloudhub.User
		err := s.each(ctx, func(u *cloudhub.User) {
			if user != nil {
				return
			}
			if u.Name == *q.Name && u.Provider == *q.Provider && u.Scheme == *q.Scheme {
				user = u
			}
		})

		if err != nil {
			return nil, err
		}

		if user == nil {
			return nil, cloudhub.ErrUserNotFound
		}

		return user, nil
	}

	return nil, fmt.Errorf("must specify either ID, or Name, Provider, and Scheme in UserQuery")
}

func (s *usersStore) userExists(ctx context.Context, u *cloudhub.User) (bool, error) {
	_, err := s.Get(ctx, cloudhub.UserQuery{
		Name:     &u.Name,
		Provider: &u.Provider,
		Scheme:   &u.Scheme,
	})
	if err == cloudhub.ErrUserNotFound {
		return false, nil
	}

	if err != nil {
		return false, err
	}

	return true, nil
}

// Add a new User to the usersStore.
func (s *usersStore) Add(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
	if u == nil {
		return nil, fmt.Errorf("user provided is nil")
	}
	userExists, err := s.userExists(ctx, u)
	if err != nil {
		return nil, err
	}
	if userExists {
		return nil, cloudhub.ErrUserAlreadyExists
	}
	if err := s.client.kv.Update(ctx, func(tx Tx) error {
		b := tx.Bucket(usersBucket)
		seq, err := b.NextSequence()
		if err != nil {
			return err
		}
		u.ID = seq
		if v, err := internal.MarshalUser(u); err != nil {
			return err
		} else if err := b.Put(u64tob(seq), v); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return u, nil
}

// Delete a user from the usersStore
func (s *usersStore) Delete(ctx context.Context, u *cloudhub.User) error {
	_, err := s.get(ctx, u.ID)
	if err != nil {
		return err
	}
	return s.client.kv.Update(ctx, func(tx Tx) error {
		return tx.Bucket(usersBucket).Delete(u64tob(u.ID))
	})
}

// Update a user
func (s *usersStore) Update(ctx context.Context, u *cloudhub.User) error {
	_, err := s.get(ctx, u.ID)
	if err != nil {
		return err
	}
	return s.client.kv.Update(ctx, func(tx Tx) error {
		if v, err := internal.MarshalUser(u); err != nil {
			return err
		} else if err := tx.Bucket(usersBucket).Put(u64tob(u.ID), v); err != nil {
			return err
		}
		return nil
	})
}

// All returns all users
func (s *usersStore) All(ctx context.Context) ([]cloudhub.User, error) {
	var users []cloudhub.User
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(usersBucket).ForEach(func(k, v []byte) error {
			var user cloudhub.User
			if err := internal.UnmarshalUser(v, &user); err != nil {
				return err
			}
			users = append(users, user)
			return nil
		})
	}); err != nil {
		return nil, err
	}

	return users, nil
}
