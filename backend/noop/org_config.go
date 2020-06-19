package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure OrganizationConfigStore implements cloudhub.OrganizationConfigStore
var _ cloudhub.OrganizationConfigStore = &OrganizationConfigStore{}

// OrganizationConfigStore is an empty struct for satisfying an interface and returning errors.
type OrganizationConfigStore struct{}

// All returns an error
func (s *OrganizationConfigStore) All(context.Context) ([]cloudhub.OrganizationConfig, error) {
	return nil, cloudhub.ErrOrganizationConfigNotFound
}

// FindOrCreate returns an error
func (s *OrganizationConfigStore) FindOrCreate(context.Context, string) (*cloudhub.OrganizationConfig, error) {
	return nil, cloudhub.ErrOrganizationConfigNotFound
}

// Put returns an error
func (s *OrganizationConfigStore) Put(context.Context, *cloudhub.OrganizationConfig) error {
	return fmt.Errorf("cannot replace config")
}
