package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OrganizationConfigStore = &OrganizationConfigStore{}

type OrganizationConfigStore struct {
	FindOrCreateF func(ctx context.Context, id string) (*cloudhub.OrganizationConfig, error)
	PutF          func(ctx context.Context, c *cloudhub.OrganizationConfig) error
}

func (s *OrganizationConfigStore) FindOrCreate(ctx context.Context, id string) (*cloudhub.OrganizationConfig, error) {
	return s.FindOrCreateF(ctx, id)
}

func (s *OrganizationConfigStore) Put(ctx context.Context, c *cloudhub.OrganizationConfig) error {
	return s.PutF(ctx, c)
}
