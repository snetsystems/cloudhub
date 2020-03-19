package id

import (
	"strconv"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// tm generates an id based on current time
type tm struct {
	Now func() time.Time
}

// NewTime builds a cloudhub.ID generator based on current time
func NewTime() cloudhub.ID {
	return &tm{
		Now: time.Now,
	}
}

// Generate creates a string based on the current time as an integer
func (i *tm) Generate() (string, error) {
	return strconv.Itoa(int(i.Now().Unix())), nil
}
