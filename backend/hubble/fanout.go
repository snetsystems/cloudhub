package hubble

import (
	"context"
	"sync"

	"github.com/cilium/cilium/api/v1/flow"
)

// FanOut distributes flows from a single input channel to multiple subscribers
// without blocking on slow consumers. When a subscriber's buffer is full,
// the oldest pending flow for that subscriber is dropped.
type FanOut struct {
	in   chan *flow.Flow
	subs map[chan *flow.Flow]struct{}
	mu   sync.RWMutex
}

func NewFanOut(inBuf int) *FanOut {
	return &FanOut{
		in:   make(chan *flow.Flow, inBuf),
		subs: make(map[chan *flow.Flow]struct{}),
	}
}

// In returns the input channel; producers send flows here.
func (f *FanOut) In() chan<- *flow.Flow { return f.in }

// Subscribe returns a new buffered channel that will receive flows.
// Caller must use Unsubscribe to release resources.
func (f *FanOut) Subscribe(buf int) <-chan *flow.Flow {
	ch := make(chan *flow.Flow, buf)
	f.mu.Lock()
	f.subs[ch] = struct{}{}
	f.mu.Unlock()
	return ch
}

// Unsubscribe removes a subscriber and closes its channel.
func (f *FanOut) Unsubscribe(ch <-chan *flow.Flow) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for k := range f.subs {
		if (<-chan *flow.Flow)(k) == ch {
			delete(f.subs, k)
			close(k)
			return
		}
	}
}

// Run blocks until ctx is done, dispatching each input flow to all subscribers.
func (f *FanOut) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			f.closeAll()
			return
		case fl, ok := <-f.in:
			if !ok {
				f.closeAll()
				return
			}
			f.dispatch(fl)
		}
	}
}

func (f *FanOut) dispatch(fl *flow.Flow) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	for ch := range f.subs {
		select {
		case ch <- fl:
		default:
			// subscriber is full — drop oldest and try once more
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- fl:
			default:
			}
		}
	}
}

func (f *FanOut) closeAll() {
	f.mu.Lock()
	defer f.mu.Unlock()
	for ch := range f.subs {
		close(ch)
		delete(f.subs, ch)
	}
}
