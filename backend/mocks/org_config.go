package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.OrganizationConfigStore = &OrganizationConfigStore{}

type OrganizationConfigStore struct {
	FindOrCreateF func(ctx context.Context, id string) (*cmp.OrganizationConfig, error)
	PutF          func(ctx context.Context, c *cmp.OrganizationConfig) error
}

func (s *OrganizationConfigStore) FindOrCreate(ctx context.Context, id string) (*cmp.OrganizationConfig, error) {
	return s.FindOrCreateF(ctx, id)
}

func (s *OrganizationConfigStore) Put(ctx context.Context, c *cmp.OrganizationConfig) error {
	return s.PutF(ctx, c)
}
