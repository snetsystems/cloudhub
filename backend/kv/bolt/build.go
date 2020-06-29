package bolt

import (
	"context"

	"github.com/boltdb/bolt"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure buildStore struct implements cloudhub.BuildStore interface.
var _ cloudhub.BuildStore = &buildStore{}

// buildBucket is the bolt bucket used to store cloudhub build information
var buildBucket = []byte("Build")

// buildKey is the constant key used in the bolt bucket
var buildKey = []byte("build")

var defaultBuildInfo = cloudhub.BuildInfo{
	Version: "",
	Commit:  "",
}

// buildStore is a bolt implementation to store cloudhub build information
type buildStore struct {
	client *client
}

// Get retrieves cloudhub build information from the database
func (s *buildStore) Get(ctx context.Context) (cloudhub.BuildInfo, error) {
	var build cloudhub.BuildInfo
	if err := s.client.db.View(func(tx *bolt.Tx) error {
		var err error
		build, err = getBuildInfo(ctx, tx)
		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return build, err
	}

	return build, nil
}

// getBuildInfo retrieves the current build, falling back to a default when missing
func getBuildInfo(ctx context.Context, tx *bolt.Tx) (cloudhub.BuildInfo, error) {
	var build cloudhub.BuildInfo

	if bucket := tx.Bucket(buildBucket); bucket == nil {
		return defaultBuildInfo, nil
	} else if v := bucket.Get(buildKey); v == nil {
		return defaultBuildInfo, nil
	} else if err := internal.UnmarshalBuild(v, &build); err != nil {
		return build, err
	}

	return build, nil
}

// Update overwrites the current cloudhub build information in the database
func (s *buildStore) Update(ctx context.Context, build cloudhub.BuildInfo) error {
	if err := s.client.db.Update(func(tx *bolt.Tx) error {
		return updateBuildInfo(ctx, build, tx)
	}); err != nil {
		return err
	}

	return nil
}

func updateBuildInfo(ctx context.Context, build cloudhub.BuildInfo, tx *bolt.Tx) error {
	if v, err := internal.MarshalBuild(build); err != nil {
		return err
	} else if err := tx.Bucket(buildBucket).Put(buildKey, v); err != nil {
		return err
	}
	return nil
}
