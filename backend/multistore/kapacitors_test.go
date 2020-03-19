package multistore

import (
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestInterfaceImplementation(t *testing.T) {
	var _ cloudhub.ServersStore = &KapacitorStore{}
}
