package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.LayoutsStore = &LayoutsStore{}

// LayoutsStore ...
type LayoutsStore struct {
	AllF    func(ctx context.Context) ([]cloudhub.Layout, error)
	GetF    func(ctx context.Context, id string) (cloudhub.Layout, error)
}

// All ...
func (s *LayoutsStore) All(ctx context.Context) ([]cloudhub.Layout, error) {
	return s.AllF(ctx)
}

// Get ...
func (s *LayoutsStore) Get(ctx context.Context, id string) (cloudhub.Layout, error) {
	return s.GetF(ctx, id)
}
