package noop

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure MLNxRstStore implements cloudhub.MLNxRstStore
var _ cloudhub.MLNxRstStore = &MLNxRstStore{}

// MLNxRstStore ...
type MLNxRstStore struct{}

// All ...
func (s *MLNxRstStore) All(context.Context) ([]cloudhub.MLNxRst, error) {
	return nil, fmt.Errorf("no MLNxRst found")
}

// Add ...
func (s *MLNxRstStore) Add(context.Context, *cloudhub.MLNxRst) (*cloudhub.MLNxRst, error) {
	return nil, fmt.Errorf("failed to add MLNxRst")
}

// Delete ...
func (s *MLNxRstStore) Delete(context.Context, *cloudhub.MLNxRst) error {
	return fmt.Errorf("failed to delete MLNxRst")
}

// Get ...
func (s *MLNxRstStore) Get(ctx context.Context, q cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error) {
	return nil, cloudhub.ErrMLNxRstNotFound
}

// Update ...
func (s *MLNxRstStore) Update(context.Context, *cloudhub.MLNxRst) error {
	return fmt.Errorf("failed to update MLNxRst")
}
