package id

import (
	uuid "github.com/satori/go.uuid"
	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.ID = &UUID{}

// UUID generates a V4 uuid
type UUID struct{}

// Generate creates a UUID v4 string
func (i *UUID) Generate() (string, error) {
	return uuid.NewV4().String(), nil
}
