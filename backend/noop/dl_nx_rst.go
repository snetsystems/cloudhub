package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure DLNxRstStore implements cloudhub.DLNxRstStore
var _ cloudhub.DLNxRstStore = &DLNxRstStore{}

// DLNxRstStore ...
type DLNxRstStore struct{}

// All ...
func (s *DLNxRstStore) All(context.Context) ([]cloudhub.DLNxRst, error) {
	return nil, fmt.Errorf("no DLNxRst found")
}

// Add ...
func (s *DLNxRstStore) Add(context.Context, *cloudhub.DLNxRst) (*cloudhub.DLNxRst, error) {
	return nil, fmt.Errorf("failed to add DLNxRst")
}

// Delete ...
func (s *DLNxRstStore) Delete(context.Context, *cloudhub.DLNxRst) error {
	return fmt.Errorf("failed to delete DLNxRst")
}

// Get ...
func (s *DLNxRstStore) Get(ctx context.Context, q cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error) {
	return nil, cloudhub.ErrDLNxRstNotFound
}

// Update ...
func (s *DLNxRstStore) Update(context.Context, *cloudhub.DLNxRst) error {
	return fmt.Errorf("failed to update DLNxRst")
}
