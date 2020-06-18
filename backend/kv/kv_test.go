package kv_test

import (
	"context"
	"errors"
	"io/ioutil"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv"
	"github.com/snetsystems/cloudhub/backend/kv/bolt"
)

// NewTestClient creates new *bolt.Client with a set time and temp path.
func NewTestClient() (*kv.Service, error) {
	f, err := ioutil.TempFile("", "cloudhub-bolt-")
	if err != nil {
		return nil, errors.New("unable to open temporary boltdb file")
	}
	f.Close()

	build := cloudhub.BuildInfo{
		Version: "version",
		Commit:  "commit",
	}

	ctx := context.TODO()
	b, err := bolt.NewClient(ctx,
		bolt.WithPath(f.Name()),
		bolt.WithBuildInfo(build),
	)
	if err != nil {
		return nil, err
	}

	return kv.NewService(ctx, b)
}
