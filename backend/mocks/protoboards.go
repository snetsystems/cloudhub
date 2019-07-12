package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.ProtoboardsStore = &ProtoboardsStore{}

type ProtoboardsStore struct {
	AllF func(ctx context.Context) ([]cmp.Protoboard, error)
	GetF func(ctx context.Context, id string) (cmp.Protoboard, error)
}

func (s *ProtoboardsStore) All(ctx context.Context) ([]cmp.Protoboard, error) {
	return s.AllF(ctx)
}

func (s *ProtoboardsStore) Get(ctx context.Context, id string) (cmp.Protoboard, error) {
	return s.GetF(ctx, id)
}
