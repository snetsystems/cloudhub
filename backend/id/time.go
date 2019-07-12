package id

import (
	"strconv"
	"time"

	cmp "github.com/snetsystems/cmp/backend"
)

// tm generates an id based on current time
type tm struct {
	Now func() time.Time
}

// NewTime builds a cmp.ID generator based on current time
func NewTime() cmp.ID {
	return &tm{
		Now: time.Now,
	}
}

// Generate creates a string based on the current time as an integer
func (i *tm) Generate() (string, error) {
	return strconv.Itoa(int(i.Now().Unix())), nil
}
