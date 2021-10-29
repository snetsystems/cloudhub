package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.CSPStore = &CSPStore{}

// CSPStore mock allows all functions to be set for testing
type CSPStore struct {
	AllF    func(context.Context) ([]cloudhub.CSP, error)
	AddF    func(context.Context, *cloudhub.CSP) (*cloudhub.CSP, error)
	DeleteF func(context.Context, *cloudhub.CSP) error
	GetF    func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error)
	UpdateF func(context.Context, *cloudhub.CSP) error
}

// All ...
func (s *CSPStore) All(ctx context.Context) ([]cloudhub.CSP, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *CSPStore) Add(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
	return s.AddF(ctx, csp)
}

// Delete ...
func (s *CSPStore) Delete(ctx context.Context, csp *cloudhub.CSP) error {
	return s.DeleteF(ctx, csp)
}

// Get ...
func (s *CSPStore) Get(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *CSPStore) Update(ctx context.Context, csp *cloudhub.CSP) error {
	return s.UpdateF(ctx, csp)
}
