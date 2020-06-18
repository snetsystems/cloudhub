package bolt

import (
	"context"
	"io/ioutil"
	"os"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/stretchr/testify/require"
)

func TestNewClient(t *testing.T) {
	f, err := ioutil.TempFile("", "cloudhub-bolt-")
	require.NoError(t, err)
	f.Close()

	c, err := NewClient(context.TODO(),
		WithBuildInfo(cloudhub.BuildInfo{
			Version: "1.8.0-test",
			Commit:  "testing",
		}),
		WithPath(f.Name()),
		WithLogger(mocks.NewLogger()),
	)
	require.NoError(t, err)
	os.RemoveAll(f.Name())
	c.Close()
}

func NewService(t *testing.T) (cloudhub.KVClient, func()) {
	c, err := NewTestClient()
	require.NoError(t, err)

	s, err := kv.NewService(context.TODO(), c.Client)
	require.NoError(t, err)

	return s, func() {
		c.Close()
		s.Close()
	}
}

func TestEtcd(t *testing.T) {
	s, closeFn := NewService(t)
	defer closeFn()

	ctx := context.TODO()

	src, err := s.SourcesStore().Add(ctx, cloudhub.Source{
		Name: "test",
		URL:  "localhost:8086",
	})
	require.NoError(t, err)
	require.Equal(t, "test", src.Name)

	srcs, err := s.SourcesStore().All(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, len(srcs))
	require.Equal(t, "test", srcs[0].Name)

	require.NoError(t, s.SourcesStore().Delete(ctx, src))
}
