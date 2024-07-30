package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure DLNxRstStore mock implements cloudhub.DLNxRstStore
var _ cloudhub.DLNxRstStore = &DLNxRstStore{}

// DLNxRstStore mock allows all functions to be set for testing
type DLNxRstStore struct {
	AllF    func(context.Context) ([]cloudhub.DLNxRst, error)
	AddF    func(context.Context, *cloudhub.DLNxRst) (*cloudhub.DLNxRst, error)
	DeleteF func(context.Context, *cloudhub.DLNxRst) error
	GetF    func(ctx context.Context, q cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error)
	UpdateF func(context.Context, *cloudhub.DLNxRst) error
}

// All ...
func (s *DLNxRstStore) All(ctx context.Context) ([]cloudhub.DLNxRst, error) {
	return s.AllF(ctx)
}

// Add ...
func (s *DLNxRstStore) Add(ctx context.Context, rst *cloudhub.DLNxRst) (*cloudhub.DLNxRst, error) {
	return s.AddF(ctx, rst)
}

// Delete ...
func (s *DLNxRstStore) Delete(ctx context.Context, rst *cloudhub.DLNxRst) error {
	return s.DeleteF(ctx, rst)
}

// Get ...
func (s *DLNxRstStore) Get(ctx context.Context, q cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error) {
	return s.GetF(ctx, q)
}

// Update ...
func (s *DLNxRstStore) Update(ctx context.Context, rst *cloudhub.DLNxRst) error {
	return s.UpdateF(ctx, rst)
}
