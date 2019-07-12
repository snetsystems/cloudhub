package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

type MappingsStore struct {
	AddF    func(context.Context, *cmp.Mapping) (*cmp.Mapping, error)
	AllF    func(context.Context) ([]cmp.Mapping, error)
	DeleteF func(context.Context, *cmp.Mapping) error
	UpdateF func(context.Context, *cmp.Mapping) error
	GetF    func(context.Context, string) (*cmp.Mapping, error)
}

func (s *MappingsStore) Add(ctx context.Context, m *cmp.Mapping) (*cmp.Mapping, error) {
	return s.AddF(ctx, m)
}

func (s *MappingsStore) All(ctx context.Context) ([]cmp.Mapping, error) {
	return s.AllF(ctx)
}

func (s *MappingsStore) Delete(ctx context.Context, m *cmp.Mapping) error {
	return s.DeleteF(ctx, m)
}

func (s *MappingsStore) Get(ctx context.Context, id string) (*cmp.Mapping, error) {
	return s.GetF(ctx, id)
}

func (s *MappingsStore) Update(ctx context.Context, m *cmp.Mapping) error {
	return s.UpdateF(ctx, m)
}
