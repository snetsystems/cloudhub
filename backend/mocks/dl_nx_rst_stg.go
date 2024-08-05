package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure DLNxRstStore mock implements cloudhub.DLNxRstStore
var _ cloudhub.DLNxRstStgStore = &DLNxRstStgStore{}

// DLNxRstStgStore mock allows all functions to be set for testing
type DLNxRstStgStore struct {
	DeleteF func(ctx context.Context, q cloudhub.DLNxRstStgQuery) error
}

// Delete ...
func (s *DLNxRstStgStore) Delete(ctx context.Context, q cloudhub.DLNxRstStgQuery) error {
	return s.DeleteF(ctx, q)
}
