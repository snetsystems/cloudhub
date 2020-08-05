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
			Version: "",
			Commit:  "",
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
