package id

import (
	uuid "github.com/satori/go.uuid"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.ID = &UUID{}

// UUID generates a V4 uuid
type UUID struct{}

// Generate creates a UUID v4 string
func (i *UUID) Generate() (string, error) {
	return uuid.NewV4().String(), nil
}
