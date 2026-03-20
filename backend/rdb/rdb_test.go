package rdb_test

import (
	"testing"

	"github.com/snetsystems/cloudhub/backend/rdb"
)

// TestStoreInterface verifies the Store interface compiles correctly.
func TestStoreInterface(t *testing.T) {
	var _ rdb.Store = (rdb.Store)(nil) // compile-time check only
}
