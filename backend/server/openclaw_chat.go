package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bouk/httprouter"
	"github.com/gorilla/websocket"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	idgen "github.com/snetsystems/cloudhub/backend/id"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

const (
	maxOpenClawMessageBytes        = 64 * 1024
	maxOpenClawTitleBytes          = 512
	defaultOpenClawHistoryLimit    = 50
	maxOpenClawHistoryLimit        = 100
	defaultOpenClawHistoryMaxChars = 100000
	maxOpenClawHistoryMaxChars     = 100000
	defaultOpenClawTimeoutMs       = 10000
	maxOpenClawTimeoutMs           = 90000
)

type openClawSessionCreateRequest struct {
	Title      string `json:"title"`
	SessionKey string `json:"sessionKey"`
	AgentID    string `json:"agentId"`
}

type openClawSessionDTO struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type openClawSessionsResponse struct {
	Sessions []openClawSessionDTO `json:"sessions"`
}

type openClawMessageDTO struct {
	Role      string                 `json:"role"`
	Content   []openclaw.ContentPart `json:"content"`
	Timestamp int64                  `json:"timestamp"`
}

type openClawHistoryResponse struct {
	Offset     int                  `json:"offset"`
	NextOffset *int                 `json:"nextOffset,omitempty"`
	HasMore    bool                 `json:"hasMore"`
	Messages   []openClawMessageDTO `json:"messages"`
}

type openClawMessageRequest struct {
	Message        string `json:"message"`
	SessionKey     string `json:"sessionKey"`
	AgentID        string `json:"agentId"`
	TimeoutMs      int    `json:"timeoutMs"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type openClawMessageResponse struct {
	Status string `json:"status"`
}

type openClawEventSubscription struct {
	SessionID string `json:"sessionId"`
}

type openClawEventDTO struct {
	Type         openclaw.EventKind  `json:"type"`
	SessionID    string              `json:"sessionId"`
	State        string              `json:"state,omitempty"`
	DeltaText    string              `json:"deltaText,omitempty"`
	Reason       string              `json:"reason,omitempty"`
	ErrorKind    string              `json:"errorKind,omitempty"`
	ErrorMessage string              `json:"errorMessage,omitempty"`
	StopReason   string              `json:"stopReason,omitempty"`
	Message      *openClawMessageDTO `json:"message,omitempty"`
}

// OpenClawSessions creates or lists only sessions owned by the
// authenticated user in the current organization.
func (s *Service) OpenClawSessions(w http.ResponseWriter, r *http.Request) {
	ctx, user, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	store, ok := s.openClawSessionStore(w, ctx)
	if !ok {
		return
	}

	switch r.Method {
	case http.MethodPost:
		var request openClawSessionCreateRequest
		if err := decodeOpenClawJSON(w, r, &request); err != nil {
			s.openClawRequestError(w, err)
			return
		}
		if len(request.Title) > maxOpenClawTitleBytes {
			Error(w, http.StatusUnprocessableEntity, "title exceeds maximum length", s.Logger)
			return
		}

		sessionID, err := (&idgen.UUID{}).Generate()
		if err != nil {
			internalServerError(w, err, s.Logger)
			return
		}
		now := time.Now().UTC()
		session := &cloudhub.OpenClawSession{
			ID:             sessionID,
			OrganizationID: orgID,
			UserID:         strconv.FormatUint(user.ID, 10),
			AgentID:        "cloudhub-chat",
			SessionKey:     fmt.Sprintf("agent:cloudhub-chat:cloudhub:%s:%d:%s", orgID, user.ID, sessionID),
			Title:          strings.TrimSpace(request.Title),
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		created, err := store.Create(ctx, session)
		if err != nil {
			Error(w, http.StatusBadGateway, "unable to create session", s.Logger)
			return
		}
		encodeJSON(w, http.StatusCreated, openClawSessionResponse(*created), s.Logger)
	case http.MethodGet:
		sessions, err := store.List(ctx, orgID)
		if err != nil {
			Error(w, http.StatusBadGateway, "unable to list sessions", s.Logger)
			return
		}
		response := openClawSessionsResponse{Sessions: make([]openClawSessionDTO, 0)}
		userID := strconv.FormatUint(user.ID, 10)
		for _, session := range sessions {
			if session.OrganizationID == orgID && session.UserID == userID {
				response.Sessions = append(response.Sessions, openClawSessionResponse(session))
			}
		}
		encodeJSON(w, http.StatusOK, response, s.Logger)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// OpenClawSessionMessages returns the normalized message history for one
// owned session.
func (s *Service) OpenClawSessionMessages(w http.ResponseWriter, r *http.Request) {
	ctx, _, _, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	session, ok := s.openClawOwnedSession(w, r, ctx)
	if !ok {
		return
	}
	if s.OpenClawGateway == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}
	limit, maxChars, offset, err := openClawHistoryParams(r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	page, err := s.OpenClawGateway.History(r.Context(), openclaw.HistoryParams{
		SessionKey: session.SessionKey,
		AgentID:    session.AgentID,
		Limit:      limit,
		Offset:     offset,
		MaxChars:   maxChars,
	})
	if err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	response := openClawHistoryResponse{
		Offset:     page.Offset,
		NextOffset: page.NextOffset,
		HasMore:    page.HasMore,
		Messages:   make([]openClawMessageDTO, 0, len(page.Messages)),
	}
	for _, message := range page.Messages {
		response.Messages = append(response.Messages, openClawMessageDTO{
			Role:      message.Role,
			Content:   message.Content,
			Timestamp: message.Timestamp,
		})
	}
	encodeJSON(w, http.StatusOK, response, s.Logger)
}

// OpenClawSessionMessage sends a message through the stored Gateway
// mapping; clients cannot choose a session key or agent ID.
func (s *Service) OpenClawSessionMessage(w http.ResponseWriter, r *http.Request) {
	ctx, _, _, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	session, ok := s.openClawOwnedSession(w, r, ctx)
	if !ok {
		return
	}
	if s.OpenClawGateway == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}
	var request openClawMessageRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	request.Message = strings.TrimSpace(request.Message)
	if request.Message == "" {
		Error(w, http.StatusUnprocessableEntity, "message is required", s.Logger)
		return
	}
	if request.TimeoutMs == 0 {
		request.TimeoutMs = defaultOpenClawTimeoutMs
	}
	if request.TimeoutMs < 1 || request.TimeoutMs > maxOpenClawTimeoutMs {
		Error(w, http.StatusUnprocessableEntity, "timeoutMs is outside the allowed range", s.Logger)
		return
	}
	if strings.TrimSpace(request.IdempotencyKey) == "" {
		Error(w, http.StatusUnprocessableEntity, "idempotencyKey is required", s.Logger)
		return
	}
	callCtx, cancel := context.WithTimeout(r.Context(), time.Duration(request.TimeoutMs)*time.Millisecond)
	defer cancel()
	result, err := s.OpenClawGateway.SendMessage(callCtx, openclaw.SendMessageParams{
		SessionKey:     session.SessionKey,
		AgentID:        session.AgentID,
		Message:        request.Message,
		TimeoutMs:      request.TimeoutMs,
		IdempotencyKey: request.IdempotencyKey,
	})
	if err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	if err := s.Store.OpenClawSessions(ctx).Touch(ctx, session.ID, time.Now().UTC()); err != nil {
		Error(w, http.StatusBadGateway, "unable to update session", s.Logger)
		return
	}
	encodeJSON(w, http.StatusAccepted, openClawMessageResponse{Status: result.Status}, s.Logger)
}

// OpenClawEvents accepts one authenticated CloudHub WebSocket connection and
// forwards events only after each requested session passes ownership.
func (s *Service) OpenClawEvents(w http.ResponseWriter, r *http.Request) {
	ctx, _, _, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	if s.OpenClawGateway == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}
	fanout := s.openClawEventFanout()
	events, unsubscribe, err := fanout.Subscribe(ctx)
	if err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	defer unsubscribe()
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	var (
		subscriptions   = make(map[string]string)
		subscriptionsMu sync.RWMutex
		writeMu         sync.Mutex
		readDone        = make(chan struct{})
	)

	var firstSubscription openClawEventSubscription
	if err := ws.ReadJSON(&firstSubscription); err != nil {
		return
	}
	session, allowed := s.openClawOwnedSession(nil, withOpenClawParam(r, firstSubscription.SessionID), ctx)
	if !allowed {
		writeMu.Lock()
		_ = ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "session access denied"), time.Now().Add(time.Second))
		writeMu.Unlock()
		return
	}
	subscriptionsMu.Lock()
	subscriptions[session.SessionKey] = session.ID
	subscriptionsMu.Unlock()

	go func() {
		defer close(readDone)
		for {
			var subscription openClawEventSubscription
			if err := ws.ReadJSON(&subscription); err != nil {
				return
			}
			session, allowed := s.openClawOwnedSession(nil, withOpenClawParam(r, subscription.SessionID), ctx)
			if !allowed {
				writeMu.Lock()
				_ = ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "session access denied"), time.Now().Add(time.Second))
				writeMu.Unlock()
				return
			}
			subscriptionsMu.Lock()
			subscriptions[session.SessionKey] = session.ID
			subscriptionsMu.Unlock()
		}
	}()

	for {
		select {
		case <-readDone:
			return
		case event, open := <-events:
			if !open {
				return
			}
			if event.Kind == openclaw.EventSessionsChanged && event.Reason == "resync" {
				writeMu.Lock()
				err := ws.WriteJSON(openClawEventResponse("", event))
				writeMu.Unlock()
				if err != nil {
					return
				}
				continue
			}
			subscriptionsMu.RLock()
			sessionID, subscribed := subscriptions[event.SessionKey]
			subscriptionsMu.RUnlock()
			if !subscribed {
				continue
			}
			writeMu.Lock()
			err := ws.WriteJSON(openClawEventResponse(sessionID, event))
			writeMu.Unlock()
			if err != nil {
				return
			}
		}
	}
}

const openClawEventSubscriberBuffer = 64

// openClawEventFanout is the sole reader of a Gateway event channel. It gives
// each WebSocket its own stream so an event cannot be consumed by a different
// WebSocket before its intended recipient sees it.
type openClawEventFanout struct {
	gateway openClawGateway

	mu          sync.Mutex
	events      <-chan openclaw.GatewayEvent
	starting    bool
	startDone   chan struct{}
	subscribers map[*openClawEventSubscriber]struct{}
}

type openClawEventSubscriber struct {
	events chan openclaw.GatewayEvent
	done   chan struct{}
}

func newOpenClawEventFanout(gateway openClawGateway) *openClawEventFanout {
	return &openClawEventFanout{
		gateway:     gateway,
		subscribers: make(map[*openClawEventSubscriber]struct{}),
	}
}

// openClawFanouts holds one event fanout per Gateway client, which is the real
// invariant: a Gateway hands out a single event subscription, so every
// WebSocket client has to read from the same fanout. Keeping it here rather
// than in Service means Service carries only injected configuration, and it
// avoids writing lazily created state into whichever Service copy a handler
// bound to — NewMux takes the Service by value. Keys are always pointer
// implementations, so they are comparable.
var (
	openClawFanoutMu sync.Mutex
	openClawFanouts  = map[openClawGateway]*openClawEventFanout{}
)

func (s *Service) openClawEventFanout() *openClawEventFanout {
	openClawFanoutMu.Lock()
	defer openClawFanoutMu.Unlock()
	fanout, ok := openClawFanouts[s.OpenClawGateway]
	if !ok {
		fanout = newOpenClawEventFanout(s.OpenClawGateway)
		openClawFanouts[s.OpenClawGateway] = fanout
	}
	return fanout
}

func (f *openClawEventFanout) Subscribe(ctx context.Context) (<-chan openclaw.GatewayEvent, func(), error) {
	if err := f.start(ctx); err != nil {
		return nil, nil, err
	}
	subscriber := &openClawEventSubscriber{
		events: make(chan openclaw.GatewayEvent, openClawEventSubscriberBuffer),
		done:   make(chan struct{}),
	}
	f.mu.Lock()
	f.subscribers[subscriber] = struct{}{}
	f.mu.Unlock()

	var once sync.Once
	return subscriber.events, func() {
		once.Do(func() {
			close(subscriber.done)
			f.mu.Lock()
			delete(f.subscribers, subscriber)
			f.mu.Unlock()
		})
	}, nil
}

func (f *openClawEventFanout) start(ctx context.Context) error {
	for {
		f.mu.Lock()
		if f.events != nil {
			f.mu.Unlock()
			return nil
		}
		if f.starting {
			startDone := f.startDone
			f.mu.Unlock()
			select {
			case <-startDone:
				continue
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		f.starting = true
		f.startDone = make(chan struct{})
		startDone := f.startDone
		f.mu.Unlock()

		events, err := f.gateway.Subscribe(ctx)
		f.mu.Lock()
		f.starting = false
		if err == nil {
			f.events = events
		}
		close(startDone)
		f.mu.Unlock()
		if err != nil {
			return err
		}
		go f.forward(events)
		return nil
	}
}

func (f *openClawEventFanout) forward(events <-chan openclaw.GatewayEvent) {
	for event := range events {
		f.mu.Lock()
		subscribers := make([]*openClawEventSubscriber, 0, len(f.subscribers))
		for subscriber := range f.subscribers {
			subscribers = append(subscribers, subscriber)
		}
		f.mu.Unlock()
		for _, subscriber := range subscribers {
			select {
			case subscriber.events <- event:
			case <-subscriber.done:
			default:
				// A full queue means this WebSocket is slow. Drop this event for
				// that recipient so it cannot block dispatch to other clients.
			}
		}
	}
}

func (s *Service) openClawOwnerContext(r *http.Request) (context.Context, *cloudhub.User, string, bool) {
	ctx := r.Context()
	user, userOK := hasUserContext(ctx)
	orgID, orgOK := hasOrganizationContext(ctx)
	return ctx, user, orgID, userOK && orgOK
}

func (s *Service) openClawSessionStore(w http.ResponseWriter, ctx context.Context) (cloudhub.OpenClawSessionStore, bool) {
	if s.Store == nil {
		if w != nil {
			Error(w, http.StatusServiceUnavailable, "session store is not configured", s.Logger)
		}
		return nil, false
	}
	store := s.Store.OpenClawSessions(ctx)
	if store == nil {
		if w != nil {
			Error(w, http.StatusServiceUnavailable, "session store is not configured", s.Logger)
		}
		return nil, false
	}
	return store, true
}

func (s *Service) openClawOwnedSession(w http.ResponseWriter, r *http.Request, ctx context.Context) (*cloudhub.OpenClawSession, bool) {
	store, ok := s.openClawSessionStore(w, ctx)
	if !ok {
		return nil, false
	}
	id := httprouter.GetParamFromContext(r.Context(), "id")
	if strings.TrimSpace(id) == "" {
		if w != nil {
			Error(w, http.StatusUnprocessableEntity, "session ID is required", s.Logger)
		}
		return nil, false
	}
	session, err := store.Get(ctx, id)
	if err != nil {
		if errors.Is(err, cloudhub.ErrOpenClawSessionNotFound) {
			if w != nil {
				notFound(w, id, s.Logger)
			}
		} else if w != nil {
			Error(w, http.StatusBadGateway, "unable to load session", s.Logger)
		}
		return nil, false
	}
	if session == nil {
		if w != nil {
			notFound(w, id, s.Logger)
		}
		return nil, false
	}
	_, user, orgID, ownerOK := s.openClawOwnerContext(r)
	if !ownerOK || session.OrganizationID != orgID || session.UserID != strconv.FormatUint(user.ID, 10) {
		if w != nil {
			Error(w, http.StatusForbidden, "session access denied", s.Logger)
		}
		return nil, false
	}
	return session, true
}

func decodeOpenClawJSON(w http.ResponseWriter, r *http.Request, target interface{}) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxOpenClawMessageBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("request must contain one JSON value")
		}
		return err
	}
	return nil
}

func (s *Service) openClawRequestError(w http.ResponseWriter, err error) {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		Error(w, http.StatusRequestEntityTooLarge, "request exceeds maximum size", s.Logger)
		return
	}
	invalidJSON(w, s.Logger)
}

func openClawHistoryParams(r *http.Request) (limit, maxChars, offset int, err error) {
	limit, err = openClawQueryInt(r, "limit", defaultOpenClawHistoryLimit, 1, maxOpenClawHistoryLimit)
	if err != nil {
		return 0, 0, 0, err
	}
	maxChars, err = openClawQueryInt(r, "maxChars", defaultOpenClawHistoryMaxChars, 1, maxOpenClawHistoryMaxChars)
	if err != nil {
		return 0, 0, 0, err
	}
	offset, err = openClawQueryInt(r, "offset", 0, 0, int(^uint(0)>>1))
	if err != nil {
		return 0, 0, 0, err
	}
	return limit, maxChars, offset, nil
}

func openClawQueryInt(r *http.Request, name string, defaultValue, min, max int) (int, error) {
	value := r.URL.Query().Get(name)
	if value == "" {
		return defaultValue, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < min || parsed > max {
		return 0, fmt.Errorf("%s is outside the allowed range", name)
	}
	return parsed, nil
}

func (s *Service) openClawGatewayError(w http.ResponseWriter, err error) {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, openclaw.ErrRequestTimeout) {
		Error(w, http.StatusGatewayTimeout, "OpenClaw gateway request timed out", s.Logger)
		return
	}
	var rpcError *openclaw.RPCError
	if errors.As(err, &rpcError) && (rpcError.Code == "conflict" || rpcError.Code == "session_busy" || rpcError.Code == "already_running") {
		Error(w, http.StatusConflict, "OpenClaw gateway rejected the request due to a session conflict", s.Logger)
		return
	}
	Error(w, http.StatusBadGateway, "OpenClaw gateway request failed", s.Logger)
}

func openClawSessionResponse(session cloudhub.OpenClawSession) openClawSessionDTO {
	return openClawSessionDTO{
		ID:        session.ID,
		Title:     session.Title,
		CreatedAt: session.CreatedAt,
		UpdatedAt: session.UpdatedAt,
	}
}

func openClawEventResponse(sessionID string, event openclaw.GatewayEvent) openClawEventDTO {
	response := openClawEventDTO{
		Type:         event.Kind,
		SessionID:    sessionID,
		State:        event.State,
		DeltaText:    event.DeltaText,
		Reason:       event.Reason,
		ErrorKind:    event.ErrorKind,
		ErrorMessage: event.ErrorMessage,
		StopReason:   event.StopReason,
	}
	if event.Message != nil {
		response.Message = &openClawMessageDTO{
			Role:      event.Message.Role,
			Content:   event.Message.Content,
			Timestamp: event.Message.Timestamp,
		}
	}
	return response
}

func withOpenClawParam(r *http.Request, id string) *http.Request {
	return r.WithContext(httprouter.WithParams(r.Context(), httprouter.Params{{Key: "id", Value: id}}))
}
