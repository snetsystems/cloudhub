package multistore

import (
	"testing"

	cmp "github.com/snetsystems/cmp/backend"
)

func TestInterfaceImplementation(t *testing.T) {
	var _ cmp.ServersStore = &KapacitorStore{}
}
