package kv_test

import (
	"context"
	"errors"
	"fmt"
	"os"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv"
	"github.com/snetsystems/cloudhub/backend/kv/bolt"
	"github.com/snetsystems/cloudhub/backend/kv/etcd"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// NewTestClient creates new *bolt.Client with a set time and temp path.
func NewTestClient(backends ...string) (*kv.Service, error) {
	backend := "bolt"
	if len(backends) > 0 {
		backend = backends[0]
	}

	build := cloudhub.BuildInfo{}
	ctx := context.TODO()

	switch backend {
	case "bolt":
		f, err := os.CreateTemp("", "cloudhub-bolt-")
		if err != nil {
			return nil, errors.New("unable to open temporary boltdb file")
		}
		f.Close()
		b, err := bolt.NewClient(ctx,
			bolt.WithPath(f.Name()),
			bolt.WithBuildInfo(build),
		)
		if err != nil {
			return nil, err
		}
		return kv.NewService(ctx, b, kv.WithLogger(mocks.NewLogger()))

	case "etcd":
		e, err := etcd.NewClient(ctx,
			etcd.WithEndpoints([]string{"localhost:2379"}),
			etcd.WithLogger(mocks.NewLogger()),
		)
		if err != nil {
			return nil, err
		}
		return kv.NewService(ctx, e, kv.WithLogger(mocks.NewLogger()))

	default:
		return nil, fmt.Errorf("unsupported backend: %s", backend)
	}
}
