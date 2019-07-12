package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.LayoutsStore = &LayoutsStore{}

type LayoutsStore struct {
	AddF    func(ctx context.Context, layout cmp.Layout) (cmp.Layout, error)
	AllF    func(ctx context.Context) ([]cmp.Layout, error)
	DeleteF func(ctx context.Context, layout cmp.Layout) error
	GetF    func(ctx context.Context, id string) (cmp.Layout, error)
	UpdateF func(ctx context.Context, layout cmp.Layout) error
}

func (s *LayoutsStore) Add(ctx context.Context, layout cmp.Layout) (cmp.Layout, error) {
	return s.AddF(ctx, layout)
}

func (s *LayoutsStore) All(ctx context.Context) ([]cmp.Layout, error) {
	return s.AllF(ctx)
}

func (s *LayoutsStore) Delete(ctx context.Context, layout cmp.Layout) error {
	return s.DeleteF(ctx, layout)
}

func (s *LayoutsStore) Get(ctx context.Context, id string) (cmp.Layout, error) {
	return s.GetF(ctx, id)
}

func (s *LayoutsStore) Update(ctx context.Context, layout cmp.Layout) error {
	return s.UpdateF(ctx, layout)
}
