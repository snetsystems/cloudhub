package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OrganizationConfigStore = &OrganizationConfigStore{}

// OrganizationConfigStore ...
type OrganizationConfigStore struct {
	AllF          func(ctx context.Context) ([]cloudhub.OrganizationConfig, error)
	FindOrCreateF func(ctx context.Context, id string) (*cloudhub.OrganizationConfig, error)
	PutF          func(ctx context.Context, c *cloudhub.OrganizationConfig) error
}

// All ...
func (s *OrganizationConfigStore) All(ctx context.Context) ([]cloudhub.OrganizationConfig, error) {
	return s.AllF(ctx)
}

// FindOrCreate ...
func (s *OrganizationConfigStore) FindOrCreate(ctx context.Context, id string) (*cloudhub.OrganizationConfig, error) {
	return s.FindOrCreateF(ctx, id)
}

// Put ...
func (s *OrganizationConfigStore) Put(ctx context.Context, c *cloudhub.OrganizationConfig) error {
	return s.PutF(ctx, c)
}
