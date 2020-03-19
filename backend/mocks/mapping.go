package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type MappingsStore struct {
	AddF    func(context.Context, *cloudhub.Mapping) (*cloudhub.Mapping, error)
	AllF    func(context.Context) ([]cloudhub.Mapping, error)
	DeleteF func(context.Context, *cloudhub.Mapping) error
	UpdateF func(context.Context, *cloudhub.Mapping) error
	GetF    func(context.Context, string) (*cloudhub.Mapping, error)
}

func (s *MappingsStore) Add(ctx context.Context, m *cloudhub.Mapping) (*cloudhub.Mapping, error) {
	return s.AddF(ctx, m)
}

func (s *MappingsStore) All(ctx context.Context) ([]cloudhub.Mapping, error) {
	return s.AllF(ctx)
}

func (s *MappingsStore) Delete(ctx context.Context, m *cloudhub.Mapping) error {
	return s.DeleteF(ctx, m)
}

func (s *MappingsStore) Get(ctx context.Context, id string) (*cloudhub.Mapping, error) {
	return s.GetF(ctx, id)
}

func (s *MappingsStore) Update(ctx context.Context, m *cloudhub.Mapping) error {
	return s.UpdateF(ctx, m)
}
