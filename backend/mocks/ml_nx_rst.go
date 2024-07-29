package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure MLNxRstStore mock implements cloudhub.MLNxRstStore
var _ cloudhub.MLNxRstStore = &MLNxRstStore{}

// MLNxRstStore mock allows all functions to be set for testing
type MLNxRstStore struct {
	AllF    func(context.Context) ([]cloudhub.MLNxRst, error)
	AddF    func(context.Context, *cloudhub.MLNxRst) (*cloudhub.MLNxRst, error)
	DeleteF func(context.Context, *cloudhub.MLNxRst) error
	GetF    func(ctx context.Context, q cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error)
	UpdateF func(context.Context, *cloudhub.MLNxRst) error
}

// All ...
func (s *MLNxRstStore) All(ctx context.Context) ([]cloudhub.MLNxRst, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *MLNxRstStore) Add(ctx context.Context, rst *cloudhub.MLNxRst) (*cloudhub.MLNxRst, error) {
	return s.AddF(ctx, rst)
}

// Delete ...
func (s *MLNxRstStore) Delete(ctx context.Context, rst *cloudhub.MLNxRst) error {
	return s.DeleteF(ctx, rst)
}

// Get ...
func (s *MLNxRstStore) Get(ctx context.Context, q cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *MLNxRstStore) Update(ctx context.Context, rst *cloudhub.MLNxRst) error {
	return s.UpdateF(ctx, rst)
}
