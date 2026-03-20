package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure HostStore implements cloudhub.HostStore
var _ cloudhub.HostStore = &HostStore{}

// HostStore is a no-op HostStore used when PostgreSQL is not configured.
type HostStore struct{}

func (s *HostStore) All(context.Context) ([]cloudhub.Host, error) {
	return nil, fmt.Errorf("no HostStore configured")
}

func (s *HostStore) Add(_ context.Context, _ *cloudhub.Host) (*cloudhub.Host, error) {
	return nil, fmt.Errorf("no HostStore configured")
}

func (s *HostStore) Get(_ context.Context, _ cloudhub.HostQuery) (*cloudhub.Host, error) {
	return nil, cloudhub.ErrHostNotFound
}

func (s *HostStore) Update(_ context.Context, _ *cloudhub.Host) (*cloudhub.Host, error) {
	return nil, fmt.Errorf("no HostStore configured")
}

func (s *HostStore) Patch(_ context.Context, _ string, _ cloudhub.HostPatch) (*cloudhub.Host, error) {
	return nil, fmt.Errorf("no HostStore configured")
}

func (s *HostStore) Delete(context.Context, string) error {
	return fmt.Errorf("no HostStore configured")
}
