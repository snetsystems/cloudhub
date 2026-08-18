package server

import (
	"context"
	"testing"
	"time"

	"github.com/snetsystems/cloudhub/backend/openclaw"
)

func TestOpenClawGatewayManagerForwardDropsWhenOutputIsFull(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	manager := &openClawGatewayManager{
		ctx:             ctx,
		forwardedEvents: make(chan openclaw.GatewayEvent, 1),
	}
	manager.forwardedEvents <- openclaw.GatewayEvent{}

	events := make(chan openclaw.GatewayEvent, 1)
	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat}
	close(events)

	done := make(chan struct{})
	go func() {
		manager.forward(events)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("forward blocked while output buffer was full")
	}
}
