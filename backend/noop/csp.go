package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure CSPStore implements cloudhub.CSPStore
var _ cloudhub.CSPStore = &CSPStore{}

// CSPStore ...
type CSPStore struct{}

// All ...
func (s *CSPStore) All(context.Context) ([]cloudhub.CSP, error) {
	return nil, fmt.Errorf("no CSP found")
}

// Add ...
func (s *CSPStore) Add(context.Context, *cloudhub.CSP) (*cloudhub.CSP, error) {
	return nil, fmt.Errorf("failed to add CSP")
}

// Delete ...
func (s *CSPStore) Delete(context.Context, *cloudhub.CSP) error {
	return fmt.Errorf("failed to delete CSP")
}

// Get ...
func (s *CSPStore) Get(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
	return nil, cloudhub.ErrCSPNotFound
}

// Update ...
func (s *CSPStore) Update(context.Context, *cloudhub.CSP) error {
	return fmt.Errorf("failed to update CSP")
}
