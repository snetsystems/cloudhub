package server

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

func TestSanitizeOpenClawTitle(t *testing.T) {
	for _, tt := range []struct {
		name string
		raw  string
		want string
	}{
		{"plain", "WAS 서버 상태 점검", "WAS 서버 상태 점검"},
		{"surrounding quotes", "\"WAS 서버 점검\"", "WAS 서버 점검"},
		{"korean quotes", "「WAS 서버 점검」", "WAS 서버 점검"},
		{"newlines collapse", "WAS 서버\n점검", "WAS 서버 점검"},
		{"trailing period", "WAS 서버 점검.", "WAS 서버 점검"},
		{"empty", "   ", ""},
		{"too long is rejected", "이 대화는 WAS 서버의 상태를 점검하고 그 결과를 정리한 다음 후속 조치를 논의한 내용입니다", ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := sanitizeOpenClawTitle(tt.raw); got != tt.want {
				t.Fatalf("sanitizeOpenClawTitle(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestFallbackOpenClawTitle(t *testing.T) {
	for _, tt := range []struct {
		name     string
		question string
		want     string
	}{
		{"short question is used whole", "was-server-01 점검해줘", "was-server-01 점검해줘"},
		{"long question is cut", "was-server-01 상태가 이상한데 최근 24시간 CPU와 메모리 추이를 확인하고 원인을 알려줘", "was-server-01 상태가 이상한데 최근 24시간 CPU와 메모리…"},
		{"newlines collapse", "was-server-01\n점검해줘", "was-server-01 점검해줘"},
		{"empty question", "  ", "새 대화"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := fallbackOpenClawTitle(tt.question); got != tt.want {
				t.Fatalf("fallbackOpenClawTitle(%q) = %q, want %q", tt.question, got, tt.want)
			}
		})
	}
}

func textMessage(role, text string) openclaw.Message {
	return openclaw.Message{Role: role, Content: []openclaw.ContentPart{{Type: "text", Text: text}}}
}

func TestOpenClawFirstTurnFrom(t *testing.T) {
	t.Run("first turn is extracted", func(t *testing.T) {
		page := openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "was-server-01 점검해줘"),
			textMessage("assistant", "CPU 사용률이 92%입니다."),
		}}
		turn, ok := openClawFirstTurnFrom(page)
		if !ok {
			t.Fatal("openClawFirstTurnFrom reported no first turn")
		}
		if turn.Question != "was-server-01 점검해줘" {
			t.Fatalf("question = %q", turn.Question)
		}
		if turn.Answer != "CPU 사용률이 92%입니다." {
			t.Fatalf("answer = %q", turn.Answer)
		}
	})

	t.Run("second turn is skipped", func(t *testing.T) {
		page := openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "첫 질문"),
			textMessage("assistant", "첫 답변"),
			textMessage("user", "두 번째 질문"),
			textMessage("assistant", "두 번째 답변"),
		}}
		if _, ok := openClawFirstTurnFrom(page); ok {
			t.Fatal("a session past its first turn must not be titled again")
		}
	})

	t.Run("no user message", func(t *testing.T) {
		page := openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("assistant", "안녕하세요"),
		}}
		if _, ok := openClawFirstTurnFrom(page); ok {
			t.Fatal("a session with no question has nothing to summarize")
		}
	})

	t.Run("answer may be empty", func(t *testing.T) {
		page := openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "질문만 있음"),
		}}
		turn, ok := openClawFirstTurnFrom(page)
		if !ok {
			t.Fatal("a question alone is still a first turn")
		}
		if turn.Answer != "" {
			t.Fatalf("answer = %q, want empty", turn.Answer)
		}
	})

	t.Run("partial page is refused", func(t *testing.T) {
		page := openclaw.HistoryPage{
			HasMore: true,
			Messages: []openclaw.Message{
				textMessage("user", "창에 우연히 하나만 남은 질문"),
				textMessage("assistant", "답변"),
			},
		}
		if _, ok := openClawFirstTurnFrom(page); ok {
			t.Fatal("a page that does not hold the whole history cannot prove a first turn")
		}
	})

	t.Run("long text is capped", func(t *testing.T) {
		long := strings.Repeat("가", openClawTitleSourceRunes+500)
		page := openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", long),
			textMessage("assistant", long),
		}}
		turn, _ := openClawFirstTurnFrom(page)
		if utf8.RuneCountInString(turn.Question) > openClawTitleSourceRunes {
			t.Fatalf("question kept %d runes", utf8.RuneCountInString(turn.Question))
		}
		if utf8.RuneCountInString(turn.Answer) > openClawTitleSourceRunes {
			t.Fatalf("answer kept %d runes", utf8.RuneCountInString(turn.Answer))
		}
	})
}

func TestOpenClawTitlePrompt(t *testing.T) {
	prompt := openClawTitlePrompt(openClawFirstTurn{Question: "질문", Answer: "답변"})
	for _, want := range []string{"질문", "답변", "12"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt is missing %q:\n%s", want, prompt)
		}
	}
}

func TestOpenClawSetSessionLabel(t *testing.T) {
	gateway := &fakeOpenClawGateway{}
	err := openClawSetSessionLabel(context.Background(), gateway, "agent:a:cloudhub:1:2:s1", "WAS 서버 점검")
	if err != nil {
		t.Fatalf("openClawSetSessionLabel: %v", err)
	}
	calls := gateway.CallsFor("sessions.patch")
	if len(calls) != 1 {
		t.Fatalf("sessions.patch called %d times", len(calls))
	}
	params, ok := calls[0].(map[string]interface{})
	if !ok {
		t.Fatalf("params type %T", calls[0])
	}
	if params["key"] != "agent:a:cloudhub:1:2:s1" || params["label"] != "WAS 서버 점검" {
		t.Fatalf("params = %#v", params)
	}
	if len(params) != 2 {
		t.Fatalf("sessions.patch rejects unknown properties; params = %#v", params)
	}
}

func TestOpenClawDeleteSession(t *testing.T) {
	gateway := &fakeOpenClawGateway{}
	if err := openClawDeleteSession(context.Background(), gateway, "agent:a:cloudhub-title:t1"); err != nil {
		t.Fatalf("openClawDeleteSession: %v", err)
	}
	calls := gateway.CallsFor("sessions.delete")
	if len(calls) != 1 {
		t.Fatalf("sessions.delete called %d times", len(calls))
	}
}

func TestSummarizeOpenClawTitleUsesSummary(t *testing.T) {
	events := make(chan openclaw.GatewayEvent, 4)
	gateway := &fakeOpenClawGateway{}
	gateway.sendHook = func(params openclaw.SendMessageParams) {
		events <- openclaw.GatewayEvent{
			Kind:       openclaw.EventChat,
			SessionKey: params.SessionKey,
			State:      "final",
			Message:    &openclaw.Message{Role: "assistant", Content: []openclaw.ContentPart{{Type: "text", Text: "WAS 서버 점검"}}},
		}
	}

	title := summarizeOpenClawTitle(context.Background(), gateway, events, "agent-1", "agent:agent-1:cloudhub-title:t1",
		openClawFirstTurn{Question: "was-server-01 점검해줘", Answer: "CPU 92%"})

	if title != "WAS 서버 점검" {
		t.Fatalf("title = %q", title)
	}
	if len(gateway.CallsFor("sessions.delete")) != 1 {
		t.Fatal("the throwaway session must be deleted")
	}
}

func TestSummarizeOpenClawTitleFallsBackOnTimeout(t *testing.T) {
	events := make(chan openclaw.GatewayEvent)
	gateway := &fakeOpenClawGateway{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // no reply will ever arrive

	title := summarizeOpenClawTitle(ctx, gateway, events, "agent-1", "agent:agent-1:cloudhub-title:t1",
		openClawFirstTurn{Question: "was-server-01 점검해줘"})

	if title != "was-server-01 점검해줘" {
		t.Fatalf("title = %q, want the fallback", title)
	}
}

func TestSummarizeOpenClawTitleFallsBackOnSendError(t *testing.T) {
	events := make(chan openclaw.GatewayEvent, 1)
	gateway := &fakeOpenClawGateway{sendErr: errors.New("gateway down")}

	title := summarizeOpenClawTitle(context.Background(), gateway, events, "agent-1", "agent:agent-1:cloudhub-title:t1",
		openClawFirstTurn{Question: "질문"})

	if title != "질문" {
		t.Fatalf("title = %q, want the fallback", title)
	}
}

func TestSummarizeOpenClawTitleFallsBackOnUnusableReply(t *testing.T) {
	events := make(chan openclaw.GatewayEvent, 4)
	gateway := &fakeOpenClawGateway{}
	gateway.sendHook = func(params openclaw.SendMessageParams) {
		events <- openclaw.GatewayEvent{
			Kind:       openclaw.EventChat,
			SessionKey: params.SessionKey,
			State:      "final",
			Message: &openclaw.Message{Role: "assistant", Content: []openclaw.ContentPart{{
				Type: "text",
				Text: "이 대화는 WAS 서버의 상태를 점검하고 그 결과를 정리한 다음 후속 조치를 논의한 내용입니다",
			}}},
		}
	}

	title := summarizeOpenClawTitle(context.Background(), gateway, events, "agent-1", "agent:agent-1:cloudhub-title:t1",
		openClawFirstTurn{Question: "was-server-01 점검해줘"})

	if title != "was-server-01 점검해줘" {
		t.Fatalf("title = %q, want the fallback", title)
	}
}

// waitForOpenClawTitler blocks until the titler's settled hook fires for
// sessionID, or fails the test after a bounded wait. handle spawns titling
// work in its own goroutine (see the type's doc comment), so a test that
// triggers handle cannot assert on the result until that goroutine finishes;
// a bare time.Sleep would only paper over that race, so we wait on a real
// signal instead.
func waitForOpenClawTitler(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for the titler goroutine to finish")
	}
}

func TestOpenClawTitlerNamesFirstTurn(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000001"
	sessionKey := "agent:agent-1:cloudhub:1:2:" + sessionID

	var gotID, gotTitle string
	store := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			return &cloudhub.OpenClawSession{ID: id, AgentID: "agent-1", SessionKey: sessionKey}, nil
		},
		UpdateTitleF: func(_ context.Context, id, title string) error {
			gotID, gotTitle = id, title
			return nil
		},
	}

	gateway := &fakeOpenClawGateway{
		history: openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "was-server-01 점검해줘"),
			textMessage("assistant", "CPU 92%"),
		}},
	}

	published := 0
	var publishedSessionKey string
	done := make(chan struct{})
	titler := &openClawTitler{
		gateway: gateway,
		store:   store,
		publish: func(event openclaw.GatewayEvent) {
			if event.Kind == openclaw.EventSessionsChanged {
				published++
				publishedSessionKey = event.SessionKey
			}
		},
		logger:  &mocks.TestLogger{},
		settled: func(string) { close(done) },
	}
	// The scratch reply has to be routed back through handle itself: nothing
	// runs the titler's read loop (run) in this test, so sendHook stands in
	// for it, exactly as the Gateway fanout would in production.
	gateway.sendHook = func(params openclaw.SendMessageParams) {
		titler.handle(context.Background(), openclaw.GatewayEvent{
			Kind: openclaw.EventChat, SessionKey: params.SessionKey, State: "final",
			Message: &openclaw.Message{Role: "assistant", Content: []openclaw.ContentPart{{Type: "text", Text: "WAS 서버 점검"}}},
		})
	}

	titler.handle(context.Background(), openclaw.GatewayEvent{
		Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final",
	})
	waitForOpenClawTitler(t, done)

	if gotID != sessionID || gotTitle != "WAS 서버 점검" {
		t.Fatalf("UpdateTitle(%q, %q)", gotID, gotTitle)
	}
	patches := gateway.CallsFor("sessions.patch")
	if len(patches) != 1 {
		t.Fatalf("sessions.patch called %d times", len(patches))
	}
	if published != 1 {
		t.Fatalf("sessions.changed published %d times; the sidebar refreshes on it", published)
	}
	// The event has to carry the session's own key -- with no key (or with
	// Reason: "resync") the chat WebSocket handler either drops it or
	// broadcasts it to every connected client instead of just this session's.
	if publishedSessionKey != sessionKey {
		t.Fatalf("sessions.changed published with SessionKey %q, want %q", publishedSessionKey, sessionKey)
	}
}

func TestOpenClawTitlerSkipsLaterTurns(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000002"
	sessionKey := "agent:agent-1:cloudhub:1:2:" + sessionID

	var updateTitleCalled bool
	store := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			return &cloudhub.OpenClawSession{ID: id, AgentID: "agent-1", SessionKey: sessionKey}, nil
		},
		UpdateTitleF: func(context.Context, string, string) error {
			updateTitleCalled = true
			return nil
		},
	}
	gateway := &fakeOpenClawGateway{
		history: openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "첫 질문"),
			textMessage("assistant", "첫 답변"),
			textMessage("user", "두 번째"),
			textMessage("assistant", "두 번째 답변"),
		}},
	}

	done := make(chan struct{})
	titler := &openClawTitler{
		gateway: gateway,
		store:   store,
		logger:  &mocks.TestLogger{},
		settled: func(string) { close(done) },
	}
	titler.handle(context.Background(), openclaw.GatewayEvent{
		Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final",
	})
	waitForOpenClawTitler(t, done)

	// updateTitleCalled is only written inside the (now-finished) titler
	// goroutine and read here after waitForOpenClawTitler synchronizes on
	// settled, so this read is race-free.
	if updateTitleCalled {
		t.Fatal("a session past its first turn must not be retitled")
	}
	if gateway.SendCalls() != 0 {
		t.Fatal("no summary should be requested past the first turn")
	}
}

// TestOpenClawTitlerSkipsLaterTurnsOnlyOnce covers the fix for a session that
// is past its first turn being probed on every later reply forever: the first
// completed event should do the store.Get + History work and then mark the
// session so a second completed event short-circuits on the titled guard
// instead of repeating that work.
func TestOpenClawTitlerSkipsLaterTurnsOnlyOnce(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000006"
	sessionKey := "agent:agent-1:cloudhub:1:2:" + sessionID

	store := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			return &cloudhub.OpenClawSession{ID: id, AgentID: "agent-1", SessionKey: sessionKey}, nil
		},
		UpdateTitleF: func(context.Context, string, string) error {
			t.Fatal("a session past its first turn must not be retitled")
			return nil
		},
	}
	gateway := &fakeOpenClawGateway{
		history: openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "첫 질문"),
			textMessage("assistant", "첫 답변"),
			textMessage("user", "두 번째"),
			textMessage("assistant", "두 번째 답변"),
		}},
	}

	done := make(chan struct{})
	titler := &openClawTitler{
		gateway: gateway,
		store:   store,
		logger:  &mocks.TestLogger{},
		settled: func(string) { close(done) },
	}
	titler.handle(context.Background(), openclaw.GatewayEvent{
		Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final",
	})
	waitForOpenClawTitler(t, done)

	// The titled guard now makes handle return synchronously (alreadyTitled),
	// so no second wait is needed here.
	titler.handle(context.Background(), openclaw.GatewayEvent{
		Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final",
	})

	if gateway.historyCalls != 1 {
		t.Fatalf("History called %d times, want 1: a session past its first turn must be probed only once", gateway.historyCalls)
	}
}

func TestOpenClawTitlerIgnoresUnrelatedEvents(t *testing.T) {
	store := &mocks.OpenClawSessionStore{
		GetF: func(context.Context, string) (*cloudhub.OpenClawSession, error) {
			t.Fatal("an incomplete event must not reach the store")
			return nil, nil
		},
	}
	gateway := &fakeOpenClawGateway{}
	titler := &openClawTitler{gateway: gateway, store: store, logger: &mocks.TestLogger{}}

	// None of these ever spawns a goroutine (see handle's early returns), so
	// no synchronization is needed: they either short-circuit on Kind/State,
	// or resolve to no session ID because the key holds ":cloudhub-title:"
	// rather than ":cloudhub:".
	titler.handle(context.Background(), openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "agent:a:cloudhub:1:2:s1", State: "delta"})
	titler.handle(context.Background(), openclaw.GatewayEvent{Kind: openclaw.EventActivity, SessionKey: "agent:a:cloudhub:1:2:s1", State: "final"})
	titler.handle(context.Background(), openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "agent:agent-1:cloudhub-title:t1", State: "final"})

	if gateway.SendCalls() != 0 {
		t.Fatal("no summary should be requested for an unrelated event")
	}
}

// TestOpenClawTitlerRunNeverBlocksOnABurst exercises the property the
// controller ruling is built on: openClawEventFanout evicts a subscriber
// outright when its 64-slot buffer fills rather than blocking (dispatch,
// openclaw_chat.go), so run must drain events fast enough that a burst of
// unrelated ones (as a streaming reply produces) never queues up behind a
// slow titling call.
//
// The titling event goes in FIRST and store.Get blocks on a channel the test
// controls, so the goroutine handle spawns is still inside its slowest step
// when the burst arrives. Only then does the test send more events than the
// fanout's 64-slot subscriber buffer, over an UNBUFFERED events channel, each
// send guarded by a deadline. A synchronous handle (run calling it inline,
// the design this test exists to rule out) would still be parked in
// store.Get at that point, so run would not be back at its select to receive
// any of the burst -- every burst send would block on the unbuffered channel
// and the deadline would fire. Only a design where handle hands the slow work
// to its own goroutine and returns immediately lets run keep draining.
func TestOpenClawTitlerRunNeverBlocksOnABurst(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000003"
	sessionKey := "agent:agent-1:cloudhub:1:2:" + sessionID

	unblockGet := make(chan struct{})
	store := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			<-unblockGet
			return &cloudhub.OpenClawSession{ID: id, AgentID: "agent-1", SessionKey: sessionKey}, nil
		},
		UpdateTitleF: func(context.Context, string, string) error { return nil },
	}
	gateway := &fakeOpenClawGateway{
		history: openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "was-server-01 점검해줘"),
			textMessage("assistant", "CPU 92%"),
		}},
	}

	events := make(chan openclaw.GatewayEvent)
	done := make(chan struct{})
	titler := &openClawTitler{
		gateway: gateway,
		events:  events,
		store:   store,
		logger:  &mocks.TestLogger{},
		settled: func(string) { close(done) },
	}
	gateway.sendHook = func(params openclaw.SendMessageParams) {
		titler.handle(context.Background(), openclaw.GatewayEvent{
			Kind: openclaw.EventChat, SessionKey: params.SessionKey, State: "final",
			Message: &openclaw.Message{Role: "assistant", Content: []openclaw.ContentPart{{Type: "text", Text: "WAS 서버 점검"}}},
		})
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go titler.run(ctx)

	sendDeadline := time.After(2 * time.Second)

	// Starts titleSession, which immediately blocks inside store.Get.
	select {
	case events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final"}:
	case <-sendDeadline:
		t.Fatal("run blocked delivering the titling event")
	}

	// More than openClawEventSubscriberBuffer (64), sent while the titling
	// goroutine is still parked in store.Get above.
	for i := 0; i < 65; i++ {
		select {
		case events <- openclaw.GatewayEvent{Kind: openclaw.EventActivity, SessionKey: sessionKey, State: "delta"}:
		case <-sendDeadline:
			t.Fatal("run blocked on an unrelated event while titling was in flight; the read loop must never block")
		}
	}

	// Only now let the blocked titling run proceed to completion.
	close(unblockGet)

	waitForOpenClawTitler(t, done)
	if len(gateway.CallsFor("sessions.patch")) != 1 {
		t.Fatal("expected one sessions.patch call from the titling run")
	}
}

// TestOpenClawTitlerInFlightPreventsDuplicateTitling covers the inFlight
// guard directly: every other test in this file drives one session with one
// event, so a broken (or deleted) claim/release pair would still go green
// elsewhere. store.Get blocks until both handle calls below have returned,
// which keeps the first call's claim in place for the whole window in which
// the second call runs.
func TestOpenClawTitlerInFlightPreventsDuplicateTitling(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000004"
	sessionKey := "agent:agent-1:cloudhub:1:2:" + sessionID

	unblockGet := make(chan struct{})
	store := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			<-unblockGet
			return &cloudhub.OpenClawSession{ID: id, AgentID: "agent-1", SessionKey: sessionKey}, nil
		},
		UpdateTitleF: func(context.Context, string, string) error { return nil },
	}
	gateway := &fakeOpenClawGateway{
		history: openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "was-server-01 점검해줘"),
			textMessage("assistant", "CPU 92%"),
		}},
	}

	done := make(chan struct{})
	titler := &openClawTitler{gateway: gateway, store: store, logger: &mocks.TestLogger{}, settled: func(string) { close(done) }}
	gateway.sendHook = func(params openclaw.SendMessageParams) {
		titler.handle(context.Background(), openclaw.GatewayEvent{
			Kind: openclaw.EventChat, SessionKey: params.SessionKey, State: "final",
			Message: &openclaw.Message{Role: "assistant", Content: []openclaw.ContentPart{{Type: "text", Text: "WAS 서버 점검"}}},
		})
	}

	// The first event claims sessionID and spawns titleSession, which blocks
	// in store.Get. claim() runs synchronously inside handle (before the
	// goroutine is spawned), so by the time this call returns, the claim is
	// already in place.
	titler.handle(context.Background(), openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final"})
	// The second event for the same session arrives while store.Get is still
	// blocked, i.e. while the first claim is still held: claim() must fail,
	// so this call spawns nothing.
	titler.handle(context.Background(), openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final"})

	close(unblockGet)
	waitForOpenClawTitler(t, done)

	if gateway.SendCalls() != 1 {
		t.Fatalf("SendCalls() = %d, want 1: inFlight must prevent concurrent titling of the same session", gateway.SendCalls())
	}
}

// TestOpenClawTitlerSkipsASessionAlreadyTitled covers the titled guard: a
// session that stays "on its first turn" by openClawFirstTurnFrom's own test
// -- a regenerated reply, a duplicate final/completed pair, another client
// replying on the same key -- must not be titled a second time.
func TestOpenClawTitlerSkipsASessionAlreadyTitled(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000005"
	sessionKey := "agent:agent-1:cloudhub:1:2:" + sessionID

	store := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			return &cloudhub.OpenClawSession{ID: id, AgentID: "agent-1", SessionKey: sessionKey}, nil
		},
		UpdateTitleF: func(context.Context, string, string) error { return nil },
	}
	gateway := &fakeOpenClawGateway{
		history: openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "was-server-01 점검해줘"),
			textMessage("assistant", "CPU 92%"),
		}},
	}
	titler := &openClawTitler{gateway: gateway, store: store, logger: &mocks.TestLogger{}}
	gateway.sendHook = func(params openclaw.SendMessageParams) {
		titler.handle(context.Background(), openclaw.GatewayEvent{
			Kind: openclaw.EventChat, SessionKey: params.SessionKey, State: "final",
			Message: &openclaw.Message{Role: "assistant", Content: []openclaw.ContentPart{{Type: "text", Text: "WAS 서버 점검"}}},
		})
	}

	done := make(chan struct{})
	titler.settled = func(string) { close(done) }
	titler.handle(context.Background(), openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final"})
	waitForOpenClawTitler(t, done)

	if gateway.SendCalls() != 1 {
		t.Fatalf("SendCalls() = %d, want 1 after the first run", gateway.SendCalls())
	}

	// A second final event for the same session. The fake history is
	// unchanged (still exactly one first turn), so only the titled guard can
	// stop this from starting a fresh run. alreadyTitled makes handle return
	// synchronously without spawning a goroutine, so no wait is needed here.
	titler.handle(context.Background(), openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final"})

	if gateway.SendCalls() != 1 {
		t.Fatalf("SendCalls() = %d, want 1: an already-titled session must not be titled again", gateway.SendCalls())
	}
}

// TestOpenClawTitlerRecoversFromAPanic covers the fix for a panic inside
// titleSession being able to take the whole server down: this is a
// convenience feature driven by external Gateway data, so a panic anywhere
// in the titling path must be recovered rather than propagate out of the
// goroutine. settled still firing after the panic also confirms release
// runs -- a leaked inFlight claim would silently disable titling for this
// session forever.
func TestOpenClawTitlerRecoversFromAPanic(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000008"

	store := &mocks.OpenClawSessionStore{
		GetF: func(context.Context, string) (*cloudhub.OpenClawSession, error) {
			panic("boom")
		},
	}
	titler := &openClawTitler{
		gateway: &fakeOpenClawGateway{},
		store:   store,
		logger:  &mocks.TestLogger{},
	}

	done := make(chan struct{})
	titler.settled = func(string) { close(done) }

	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("panic escaped titleSession: %v", r)
			}
		}()
		titler.titleSession(context.Background(), sessionID)
	}()
	waitForOpenClawTitler(t, done)

	if !titler.claim(sessionID) {
		t.Fatal("inFlight claim was leaked by the panic; release must still run")
	}
}

func TestStartOpenClawTitlerWithoutGateway(t *testing.T) {
	service := &Service{Logger: &mocks.TestLogger{}}
	if err := service.StartOpenClawTitler(context.Background()); err != nil {
		t.Fatalf("StartOpenClawTitler without a gateway should be a no-op, got %v", err)
	}
}

// TestOpenClawTitlerSubscribeRetriesAfterAFailure covers the fix for
// auto-titling never starting in production: newOpenClawGatewayClient hands
// back a disconnected client that dials the Gateway asynchronously, so the
// first fanout.Subscribe attempted right after StartOpenClawTitler is called
// routinely fails with ErrDisconnected. The fake gateway here fails its first
// Subscribe call the same way and only succeeds from the second call on; the
// titler must retry rather than give up, and once subscribed it must
// actually run.
//
// This drives subscribeOpenClawTitler directly against a fanout built with
// newOpenClawEventFanout, rather than going through Service.StartOpenClawTitler
// and the process-wide openClawFanouts map: that map is keyed by gateway
// pointer and never evicts entries, so two different *fakeOpenClawGateway
// values allocated at different points in a shared test binary can collide
// on a GC-reused address, which made an earlier version of this test flaky
// when run alongside the rest of the package's fanout-using tests.
func TestOpenClawTitlerSubscribeRetriesAfterAFailure(t *testing.T) {
	const sessionID = "9a1c2f7e-0000-4000-8000-000000000007"
	sessionKey := "agent:agent-1:cloudhub:1:2:" + sessionID

	events := make(chan openclaw.GatewayEvent, 4)
	gateway := &fakeOpenClawGateway{
		subscribeErr:          openclaw.ErrDisconnected,
		subscribeSucceedAfter: 1,
		events:                events,
		history: openclaw.HistoryPage{Messages: []openclaw.Message{
			textMessage("user", "was-server-01 점검해줘"),
			textMessage("assistant", "CPU 92%"),
		}},
	}
	gateway.sendHook = func(params openclaw.SendMessageParams) {
		events <- openclaw.GatewayEvent{
			Kind: openclaw.EventChat, SessionKey: params.SessionKey, State: "final",
			Message: &openclaw.Message{Role: "assistant", Content: []openclaw.ContentPart{{Type: "text", Text: "WAS 서버 점검"}}},
		}
	}

	updateTitleDone := make(chan struct{})
	var gotID, gotTitle string
	store := &mocks.OpenClawSessionStore{
		GetF: func(_ context.Context, id string) (*cloudhub.OpenClawSession, error) {
			return &cloudhub.OpenClawSession{ID: id, AgentID: "agent-1", SessionKey: sessionKey}, nil
		},
		UpdateTitleF: func(_ context.Context, id, title string) error {
			gotID, gotTitle = id, title
			close(updateTitleDone)
			return nil
		},
	}

	fanout := newOpenClawEventFanout(gateway)
	titler := &openClawTitler{
		gateway: gateway,
		store:   store,
		publish: fanout.Publish,
		logger:  &mocks.TestLogger{},
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go subscribeOpenClawTitler(ctx, fanout, titler)

	// Sent only after the retry loop is started; it has to sit in the
	// buffered channel until the retried Subscribe succeeds and run starts
	// reading, which is exactly the behavior under test.
	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: sessionKey, State: "final"}

	select {
	case <-updateTitleDone:
	case <-time.After(3 * time.Second):
		t.Fatal("titler never ran: the first Subscribe failure was never retried")
	}
	if gotID != sessionID || gotTitle != "WAS 서버 점검" {
		t.Fatalf("UpdateTitle(%q, %q)", gotID, gotTitle)
	}
	if gateway.subscribeCalls < 2 {
		t.Fatalf("Subscribe called %d times, want at least 2 (retry after the first failure)", gateway.subscribeCalls)
	}
}
