package mocks

import (
	"context"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OpenClawSessionStore = &OpenClawSessionStore{}

// OpenClawSessionStore mock allows all functions to be set for testing
type OpenClawSessionStore struct {
	CreateF      func(ctx context.Context, session *cloudhub.OpenClawSession) (*cloudhub.OpenClawSession, error)
	GetF         func(ctx context.Context, id string) (*cloudhub.OpenClawSession, error)
	ListF        func(ctx context.Context, organizationID string) ([]cloudhub.OpenClawSession, error)
	TouchF       func(ctx context.Context, id string, updatedAt time.Time) error
	UpdateTitleF func(ctx context.Context, id string, title string) error
	DeleteF      func(ctx context.Context, id string) error
}

// Create ...
func (s *OpenClawSessionStore) Create(ctx context.Context, session *cloudhub.OpenClawSession) (*cloudhub.OpenClawSession, error) {
	return s.CreateF(ctx, session)
}

// Get ...
func (s *OpenClawSessionStore) Get(ctx context.Context, id string) (*cloudhub.OpenClawSession, error) {
	return s.GetF(ctx, id)
}

// List ...
func (s *OpenClawSessionStore) List(ctx context.Context, organizationID string) ([]cloudhub.OpenClawSession, error) {
	return s.ListF(ctx, organizationID)
}

// Touch ...
func (s *OpenClawSessionStore) Touch(ctx context.Context, id string, updatedAt time.Time) error {
	return s.TouchF(ctx, id, updatedAt)
}

// UpdateTitle renames a session.
func (s *OpenClawSessionStore) UpdateTitle(ctx context.Context, id string, title string) error {
	return s.UpdateTitleF(ctx, id, title)
}

// Delete ...
func (s *OpenClawSessionStore) Delete(ctx context.Context, id string) error {
	return s.DeleteF(ctx, id)
}
