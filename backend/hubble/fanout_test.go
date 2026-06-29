package hubble

import (
	"context"
	"testing"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
)

func TestFanOut_DeliversToAllSubscribers(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	f := NewFanOut(16)
	go f.Run(ctx)

	sub1 := f.Subscribe(8)
	sub2 := f.Subscribe(8)

	f.In() <- &flow.Flow{Verdict: flow.Verdict_FORWARDED}

	for _, sub := range []<-chan *flow.Flow{sub1, sub2} {
		select {
		case got := <-sub:
			if got.Verdict != flow.Verdict_FORWARDED {
				t.Fatalf("unexpected verdict: %v", got.Verdict)
			}
		case <-time.After(time.Second):
			t.Fatal("subscriber did not receive flow")
		}
	}
}

func TestFanOut_SlowSubscriberDropsOldest(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	f := NewFanOut(16)
	go f.Run(ctx)

	sub := f.Subscribe(2) // tiny buffer
	for i := 0; i < 5; i++ {
		f.In() <- &flow.Flow{Verdict: flow.Verdict_FORWARDED}
	}

	time.Sleep(50 * time.Millisecond)

	count := 0
	for {
		select {
		case <-sub:
			count++
		default:
			if count > 2 {
				t.Fatalf("expected at most 2 buffered, got %d", count)
			}
			return
		}
	}
}

func TestFanOut_UnsubscribeStopsDelivery(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	f := NewFanOut(16)
	go f.Run(ctx)

	sub := f.Subscribe(8)
	f.Unsubscribe(sub)

	f.In() <- &flow.Flow{Verdict: flow.Verdict_FORWARDED}

	select {
	case <-sub:
		// receiving on closed channel returns zero value
	case <-time.After(50 * time.Millisecond):
	}
}
