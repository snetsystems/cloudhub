package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.ProtoboardsStore = &ProtoboardsStore{}

type ProtoboardsStore struct {
	AllF func(ctx context.Context) ([]cloudhub.Protoboard, error)
	GetF func(ctx context.Context, id string) (cloudhub.Protoboard, error)
}

func (s *ProtoboardsStore) All(ctx context.Context) ([]cloudhub.Protoboard, error) {
	return s.AllF(ctx)
}

func (s *ProtoboardsStore) Get(ctx context.Context, id string) (cloudhub.Protoboard, error) {
	return s.GetF(ctx, id)
}
