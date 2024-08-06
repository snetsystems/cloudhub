package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure DLNxRstStore implements cloudhub.DLNxRstStore
var _ cloudhub.DLNxRstStgStore = &DLNxRstStgStore{}

// DLNxRstStgStore ...
type DLNxRstStgStore struct{}

// Delete ...
func (s *DLNxRstStgStore) Delete(ctx context.Context, q cloudhub.DLNxRstStgQuery) error {
	return fmt.Errorf("failed to delete DLNxRst")
}
