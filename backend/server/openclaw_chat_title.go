package server

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	idgen "github.com/snetsystems/cloudhub/backend/id"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

// openClawMaxTitleRunes is not a storage limit but a quality gate: the
// summarizer is asked for a short noun phrase, so anything longer means it
// answered with a sentence and the reply is not usable as a title.
const openClawMaxTitleRunes = 40

// openClawTitleTrimCutset holds the wrappers a summarizer tends to put around
// a title even when told not to.
const openClawTitleTrimCutset = " \t\r\n\"'`“”‘’「」『』<>[]()*#.。"

// sanitizeOpenClawTitle reduces a summarizer reply to a single line fit for a
// sidebar entry, and reports an unusable reply as an empty string so the
// caller can fall back.
func sanitizeOpenClawTitle(raw string) string {
	title := strings.Join(strings.Fields(raw), " ")
	title = strings.Trim(title, openClawTitleTrimCutset)
	if title == "" {
		return ""
	}
	if utf8.RuneCountInString(title) > openClawMaxTitleRunes {
		return ""
	}
	return title
}

// fallbackOpenClawTitle derives a title from the question alone. It always
// returns something: a mediocre title beats "신규 대화 세션 #42".
func fallbackOpenClawTitle(question string) string {
	title := strings.Join(strings.Fields(question), " ")
	if title == "" {
		return "새 대화"
	}
	runes := []rune(title)
	if len(runes) > openClawMaxTitleRunes {
		// Leave room for the ellipsis so the result still fits the cap.
		return string(runes[:openClawMaxTitleRunes-1]) + "…"
	}
	return title
}

// openClawTitleSourceRunes caps how much of the first turn is quoted into the
// summarizer prompt. A reply can carry a whole command output, and the
// summarizer only needs enough to name the topic.
const openClawTitleSourceRunes = 1200

// openClawFirstTurn is the opening question and reply a title is derived from.
type openClawFirstTurn struct {
	Question string
	Answer   string
}

// openClawFirstTurnFrom reports the opening exchange, and false once the
// session has moved past it. Being past the first turn is what keeps a session
// from being retitled on every reply, so this is the guard, not a filter.
func openClawFirstTurnFrom(page openclaw.HistoryPage) (openClawFirstTurn, bool) {
	// chat.history returns the most recent messages when a Limit is set, so a
	// partial page cannot prove anything about the start of the conversation.
	// Only a page that holds the whole history can.
	if page.HasMore {
		return openClawFirstTurn{}, false
	}
	var turn openClawFirstTurn
	users := 0
	for _, message := range page.Messages {
		switch message.Role {
		case "user":
			users++
			if users > 1 {
				return openClawFirstTurn{}, false
			}
			turn.Question = openClawMessageText(message)
		case "assistant":
			if users == 1 && turn.Answer == "" {
				turn.Answer = openClawMessageText(message)
			}
		}
	}
	if users != 1 || turn.Question == "" {
		return openClawFirstTurn{}, false
	}
	turn.Question = capOpenClawRunes(turn.Question, openClawTitleSourceRunes)
	turn.Answer = capOpenClawRunes(turn.Answer, openClawTitleSourceRunes)
	return turn, true
}

// openClawMessageText joins the text parts of a message and drops the rest;
// a tool call block names a tool, not the topic.
func openClawMessageText(message openclaw.Message) string {
	var parts []string
	for _, part := range message.Content {
		if part.Type != "" && part.Type != "text" {
			continue
		}
		if text := strings.TrimSpace(part.Text); text != "" {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, " ")
}

func capOpenClawRunes(text string, limit int) string {
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit])
}

// openClawTitlePrompt asks for a title and nothing else. The constraint is
// repeated because a small model tends to answer with a sentence.
func openClawTitlePrompt(turn openClawFirstTurn) string {
	var b strings.Builder
	b.WriteString("아래 대화의 제목을 지어라.\n")
	b.WriteString("규칙: 12자 이내의 명사구 하나만 출력한다. 설명, 인사, 따옴표, 마침표를 붙이지 않는다.\n\n")
	b.WriteString("[질문]\n")
	b.WriteString(turn.Question)
	if turn.Answer != "" {
		b.WriteString("\n\n[답변]\n")
		b.WriteString(turn.Answer)
	}
	b.WriteString("\n\n제목:")
	return b.String()
}

// openClawSetSessionLabel writes the title onto the Gateway's own session
// entry. "label" is the only writable name field the Gateway accepts, and it
// reads back as both label and displayName; sending "title" is rejected.
func openClawSetSessionLabel(ctx context.Context, gateway openClawGateway, sessionKey, label string) error {
	_, err := gateway.Call(ctx, "sessions.patch", map[string]interface{}{
		"key":   sessionKey,
		"label": label,
	})
	return err
}

// openClawDeleteSession removes a session from the Gateway. It is used only
// for the throwaway session a summary runs in.
func openClawDeleteSession(ctx context.Context, gateway openClawGateway, sessionKey string) error {
	_, err := gateway.Call(ctx, "sessions.delete", map[string]interface{}{
		"key": sessionKey,
	})
	return err
}

// openClawTitleTimeout bounds one summary. The title is a convenience, so it
// gives up rather than holding a worker slot on a stuck run. 120s rather than
// a tighter cap: two live summaries against the real agent measured 42.0s and
// 15.5s, and 42s already leaves little headroom under a 60s cap -- a slower
// turn would silently fall back to the truncated question.
const openClawTitleTimeout = 120 * time.Second

// summarizeOpenClawTitle asks the agent to name the conversation, in a
// throwaway session so the request never appears in the user's history. It
// always returns a usable title: the summary when one arrives in time, the
// question otherwise.
//
// The scratch key is supplied by the caller (the titler worker) rather than
// generated here: the worker has to register the key's reply channel before
// the send goes out, or an early reply could arrive with nowhere to land.
func summarizeOpenClawTitle(
	ctx context.Context,
	gateway openClawGateway,
	events <-chan openclaw.GatewayEvent,
	agentID, scratchKey string,
	turn openClawFirstTurn,
) string {
	fallback := fallbackOpenClawTitle(turn.Question)

	ctx, cancel := context.WithTimeout(ctx, openClawTitleTimeout)
	defer cancel()

	// The scratch session outlives the send only until its reply lands, but
	// delete on every exit: a failed run still leaves an entry behind.
	defer func() {
		// A cancelled ctx cannot carry the cleanup call.
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		_ = openClawDeleteSession(cleanupCtx, gateway, scratchKey)
	}()

	idempotencyKey, err := (&idgen.UUID{}).Generate()
	if err != nil {
		return fallback
	}
	if _, err := gateway.SendMessage(ctx, openclaw.SendMessageParams{
		SessionKey:     scratchKey,
		AgentID:        agentID,
		Message:        openClawTitlePrompt(turn),
		TimeoutMs:      int(openClawTitleTimeout / time.Millisecond),
		IdempotencyKey: idempotencyKey,
	}); err != nil {
		return fallback
	}

	var reply strings.Builder
	for {
		select {
		case <-ctx.Done():
			return fallback
		case event, ok := <-events:
			if !ok {
				return fallback
			}
			if event.Kind != openclaw.EventChat || event.SessionKey != scratchKey {
				continue
			}
			if event.DeltaText != "" {
				reply.WriteString(event.DeltaText)
			}
			if event.Message != nil {
				if text := openClawMessageText(*event.Message); text != "" {
					reply.Reset()
					reply.WriteString(text)
				}
			}
			switch event.State {
			case "final", "completed":
				if title := sanitizeOpenClawTitle(reply.String()); title != "" {
					return title
				}
				return fallback
			case "error", "aborted":
				return fallback
			}
		}
	}
}

// openClawTitleHistoryLimit bounds the history page fetched to decide whether
// a session is still on its first turn. A tool-heavy first turn can run to
// dozens of entries, and openClawFirstTurnFrom refuses any page that does not
// hold the whole history (HasMore), so the window has to be generous.
const openClawTitleHistoryLimit = 100

// openClawTitler names a session once its opening exchange completes.
//
// Its read loop (run) must never block: it is fed through openClawEventFanout
// (openclaw_chat.go), whose dispatch evicts a subscriber outright when that
// subscriber's 64-slot buffer fills rather than blocking or dropping a single
// event (see dispatch/removeSubscriber). A streaming reply emits many delta
// events, so any handler that blocks the loop for the length of a summary
// call gets its channel closed and silently stops titling for the rest of
// the process's life. handle therefore only ever does cheap, non-blocking
// work: route an event to a pending summary's feed, or hand off a candidate
// first-turn event to its own goroutine.
type openClawTitler struct {
	gateway openClawGateway
	events  <-chan openclaw.GatewayEvent
	store   cloudhub.OpenClawSessionStore
	publish func(openclaw.GatewayEvent)
	logger  cloudhub.Logger

	mu sync.Mutex
	// pending routes a scratch session's reply events to the goroutine
	// summarizing it, keyed by the scratch session key.
	pending map[string]chan openclaw.GatewayEvent
	// inFlight keeps a CloudHub session from being titled twice at once, keyed
	// by the CloudHub session ID.
	inFlight map[string]struct{}
	// titled remembers which CloudHub session IDs have already been named,
	// keyed by session ID. It is process-local rather than persisted: Title
	// is never actually empty -- the frontend seeds a placeholder like "신규
	// 대화 세션 #42" -- so the only failure mode of forgetting this on a
	// restart is a session still on its first turn getting titled once more:
	// a visible but harmless duplicate, not a broken invariant. A persisted
	// flag (a store column) would be a larger change than that risk warrants.
	titled map[string]struct{}

	// settled, when set, is called after one titling attempt finishes,
	// whether it produced a title or bailed out early. Production leaves it
	// nil; tests use it to wait for handle's goroutine instead of sleeping.
	settled func(sessionID string)
}

// openClawSessionIDFromKey pulls the CloudHub session ID out of a session key.
// Keys are built as agent:<agentID>:cloudhub:<orgID>:<userID>:<sessionID> in
// OpenClawSessions, so the ID is the last segment.
func openClawSessionIDFromKey(sessionKey string) string {
	if !strings.Contains(sessionKey, ":cloudhub:") {
		return ""
	}
	index := strings.LastIndex(sessionKey, ":")
	if index < 0 || index == len(sessionKey)-1 {
		return ""
	}
	return sessionKey[index+1:]
}

func (t *openClawTitler) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-t.events:
			if !ok {
				return
			}
			t.handle(ctx, event)
		}
	}
}

// handle routes one event. It never blocks: a reply for a summary already in
// flight is forwarded to that summary's own goroutine over a buffered,
// non-blocking send (dropping it rather than waiting), and a candidate first
// turn is handed off to a new goroutine. Everything slow — the store read,
// the history fetch, the summarize call, the writes — happens off this
// caller's goroutine.
func (t *openClawTitler) handle(ctx context.Context, event openclaw.GatewayEvent) {
	if event.Kind == openclaw.EventChat {
		if feed, ok := t.pendingFeed(event.SessionKey); ok {
			select {
			case feed <- event:
			default:
				// The summary's own buffer is full; summarizeOpenClawTitle
				// will time out and fall back rather than this loop blocking.
			}
			return
		}
	}
	if event.Kind != openclaw.EventChat {
		return
	}
	if event.State != "final" && event.State != "completed" {
		return
	}
	sessionID := openClawSessionIDFromKey(event.SessionKey)
	if sessionID == "" {
		return
	}
	if t.alreadyTitled(sessionID) {
		// A regenerated reply, a duplicate final/completed pair, or another
		// client replying on the same key would otherwise start a whole new
		// run -- new scratch session, new SendMessage, new UpdateTitle, new
		// sessions.patch, new sessions.changed -- even though the session
		// stays "on its first turn" by openClawFirstTurnFrom's own test for
		// as long as it holds exactly one user message.
		return
	}
	if !t.claim(sessionID) {
		// Already being titled; a second concurrent run would race the first.
		return
	}
	go t.titleSession(ctx, sessionID)
}

// titleSession does the actual work of naming one session. It always
// releases the session's inFlight claim, and calls t.settled (if set) last so
// tests can wait for it deterministically.
func (t *openClawTitler) titleSession(ctx context.Context, sessionID string) {
	defer func() {
		t.release(sessionID)
		if t.settled != nil {
			t.settled(sessionID)
		}
	}()
	// This goroutine runs off Gateway-driven data outside any HTTP request;
	// nothing upstream can recover a panic here, and auto-titling is a
	// convenience, not something worth taking the whole server down for.
	defer func() {
		if r := recover(); r != nil {
			t.logger.
				WithField("component", "openclaw-titler").
				WithField("session", sessionID).
				WithField("panic", fmt.Sprintf("%v", r)).
				Error("recovered from a panic while titling a session")
		}
	}()

	session, err := t.store.Get(ctx, sessionID)
	if err != nil || session == nil {
		return
	}

	page, err := t.gateway.History(ctx, openclaw.HistoryParams{
		SessionKey: session.SessionKey,
		AgentID:    session.AgentID,
		Limit:      openClawTitleHistoryLimit,
	})
	if err != nil {
		return
	}
	turn, ok := openClawFirstTurnFrom(page)
	if !ok {
		// Reuse the titled set: once a session is confirmed to be past its
		// first turn, it will never be a candidate again, which is exactly
		// what titled already gates on. Without this, every completed reply
		// for the rest of the session's life re-triggers this goroutine --
		// a store.Get plus a wasted 100-message History call every time.
		// Accepted consequence: a first turn whose own history exceeds
		// openClawTitleHistoryLimit also returns false here (HasMore), so
		// such a session is permanently skipped rather than retried once
		// more history exists.
		t.markTitled(sessionID)
		return
	}

	// Name the session from the question first. Summarizing is a full agent
	// turn -- measured at 15 to 60 seconds against gpt-oss:20b -- and a
	// sidebar entry should not read "신규 대화 세션 #42" for a minute while
	// that runs. The summary replaces this in place when it arrives.
	provisional := fallbackOpenClawTitle(turn.Question)
	if !t.applyTitle(ctx, session, provisional) {
		return
	}
	t.markTitled(session.ID)

	scratchID, err := (&idgen.UUID{}).Generate()
	if err != nil {
		return
	}
	scratchKey := fmt.Sprintf("agent:%s:cloudhub-title:%s", session.AgentID, scratchID)
	feed := make(chan openclaw.GatewayEvent, openClawEventSubscriberBuffer)
	t.registerPending(scratchKey, feed)
	defer t.unregisterPending(scratchKey)

	title := summarizeOpenClawTitle(ctx, t.gateway, feed, session.AgentID, scratchKey, turn)
	if title == provisional {
		// Summarizing failed and fell back to the same question-derived
		// title. Writing it again would only make the sidebar flicker.
		return
	}
	t.applyTitle(ctx, session, title)
}

// applyTitle stores one title and mirrors it, reporting whether the store
// write landed. A title is written twice per session -- the question first,
// the summary once it arrives -- so this is the shared half.
func (t *openClawTitler) applyTitle(ctx context.Context, session *cloudhub.OpenClawSession, title string) bool {
	if err := t.store.UpdateTitle(ctx, session.ID, title); err != nil {
		t.logger.
			WithField("component", "openclaw-titler").
			WithField("session", session.ID).
			WithField("error", err.Error()).
			Error("unable to store the generated session title")
		return false
	}
	if err := openClawSetSessionLabel(ctx, t.gateway, session.SessionKey, title); err != nil {
		// CloudHub already shows the title; the Gateway label is only for
		// consistency in other OpenClaw clients.
		t.logger.
			WithField("component", "openclaw-titler").
			WithField("session", session.ID).
			WithField("error", err.Error()).
			Info("unable to mirror the session title onto the Gateway")
	}
	if t.publish != nil {
		// SessionKey is set (and Reason left empty) so the chat WebSocket
		// handler (openclaw_chat.go) resolves this through its per-session
		// subscriptions map and refreshes only the client watching this
		// session -- Reason: "resync" would instead broadcast to every
		// connected client and make each of them refetch sessions, messages
		// and approvals just because one session got titled.
		t.publish(openclaw.GatewayEvent{Kind: openclaw.EventSessionsChanged, SessionKey: session.SessionKey})
	}
	return true
}

func (t *openClawTitler) claim(sessionID string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.inFlight == nil {
		t.inFlight = make(map[string]struct{})
	}
	if _, ok := t.inFlight[sessionID]; ok {
		return false
	}
	t.inFlight[sessionID] = struct{}{}
	return true
}

func (t *openClawTitler) release(sessionID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.inFlight, sessionID)
}

func (t *openClawTitler) alreadyTitled(sessionID string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	_, ok := t.titled[sessionID]
	return ok
}

func (t *openClawTitler) markTitled(sessionID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.titled == nil {
		t.titled = make(map[string]struct{})
	}
	t.titled[sessionID] = struct{}{}
}

func (t *openClawTitler) registerPending(scratchKey string, feed chan openclaw.GatewayEvent) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.pending == nil {
		t.pending = make(map[string]chan openclaw.GatewayEvent)
	}
	t.pending[scratchKey] = feed
}

func (t *openClawTitler) unregisterPending(scratchKey string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.pending, scratchKey)
}

func (t *openClawTitler) pendingFeed(sessionKey string) (chan openclaw.GatewayEvent, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	feed, ok := t.pending[sessionKey]
	return feed, ok
}

// openClawTitlerSubscribeMinBackoff and openClawTitlerSubscribeMaxBackoff
// bound the retry in subscribeOpenClawTitler: start at ~1s so a Gateway that
// finishes its async dial quickly picks up titling almost immediately, cap at
// ~30s so a Gateway that is down for a while does not get hammered.
const (
	openClawTitlerSubscribeMinBackoff = time.Second
	openClawTitlerSubscribeMaxBackoff = 30 * time.Second
)

// StartOpenClawTitler subscribes the session titler to Gateway events. It is a
// no-op when the OpenClaw integration is not configured, which is the normal
// state of a CloudHub without a Gateway.
//
// When a Gateway IS configured, the subscribe is not one-shot: the client
// returned by newOpenClawGatewayClient starts disconnected and dials the
// Gateway asynchronously in its own goroutine (manager.run/reconnect,
// server.go), so a Subscribe attempted right after the client is constructed
// routinely fails with ErrDisconnected. Retrying with a bounded backoff is
// what lets auto-titling come up once the dial completes, instead of staying
// dead for the rest of the process's life.
func (s *Service) StartOpenClawTitler(ctx context.Context) error {
	if s.OpenClawGateway == nil {
		return nil
	}
	fanout := s.openClawEventFanout()
	titler := &openClawTitler{
		gateway: s.OpenClawGateway,
		store:   s.Store.OpenClawSessions(serverContext(ctx)),
		publish: fanout.Publish,
		logger:  s.Logger,
	}
	go subscribeOpenClawTitler(ctx, fanout, titler)
	return nil
}

// subscribeOpenClawTitler retries fanout.Subscribe until it succeeds or ctx is
// done, then runs the titler on the resulting event stream. It never logs per
// retry attempt -- only once, on the successful subscription -- so a Gateway
// that is down for a while does not spam the log.
func subscribeOpenClawTitler(ctx context.Context, fanout *openClawEventFanout, titler *openClawTitler) {
	backoff := openClawTitlerSubscribeMinBackoff
	for {
		events, _, unsubscribe, err := fanout.Subscribe(ctx)
		if err == nil {
			titler.events = events
			defer unsubscribe()
			titler.logger.
				WithField("component", "openclaw-titler").
				Info("subscribed to Gateway events; session auto-titling is active")
			titler.run(ctx)
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff *= 2
		if backoff > openClawTitlerSubscribeMaxBackoff {
			backoff = openClawTitlerSubscribeMaxBackoff
		}
	}
}
