package noop

import (
	"context"
	"fmt"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.OpenClawSessionStore = (*OpenClawSessionStore)(nil)

// OpenClawSessionStore is used when PostgreSQL is not configured.
type OpenClawSessionStore struct{}

// Create reports that durable session persistence is unavailable.
func (*OpenClawSessionStore) Create(context.Context, *cloudhub.OpenClawSession) (*cloudhub.OpenClawSession, error) {
	return nil, fmt.Errorf("no OpenClaw session store configured")
}

// Get returns no session when durable persistence is unavailable.
func (*OpenClawSessionStore) Get(context.Context, string) (*cloudhub.OpenClawSession, error) {
	return nil, nil
}

// List returns no sessions when durable persistence is unavailable.
func (*OpenClawSessionStore) List(context.Context, string) ([]cloudhub.OpenClawSession, error) {
	return []cloudhub.OpenClawSession{}, nil
}

// Touch reports that durable session persistence is unavailable.
func (*OpenClawSessionStore) Touch(context.Context, string, time.Time) error {
	return fmt.Errorf("no OpenClaw session store configured")
}

// UpdateTitle reports that durable session persistence is unavailable.
func (*OpenClawSessionStore) UpdateTitle(context.Context, string, string) error {
	return fmt.Errorf("no OpenClaw session store configured")
}

// Delete reports that durable session persistence is unavailable.
func (*OpenClawSessionStore) Delete(context.Context, string) error {
	return fmt.Errorf("no OpenClaw session store configured")
}
