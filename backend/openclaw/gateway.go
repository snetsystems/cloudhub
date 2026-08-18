package openclaw

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
)

const gatewayProtocolVersion = 4

// Gateway client identity used on every connect. The Gateway only accepts
// client ids from a fixed registry, and it skips device pairing entirely for
// the ("gateway-client", "backend") pair, so CloudHub identifies itself as a
// pairable client and carries its own name in displayName.
const (
	gatewayClientID          = "cli"
	gatewayClientMode        = "cli"
	gatewayClientDisplayName = "CloudHub"
)

// gatewayToolEventsCap opts this connection into tool result events. The Gateway
// broadcasts a run's progress items to every operator, but sends the "tool"
// stream only to connections that asked for it at connect time, so without this
// capability an activity never reports what a tool returned. It is not part of
// the device proof payload, so advertising it does not affect pairing.
const gatewayToolEventsCap = "tool-events"

var (
	ErrClosed         = errors.New("openclaw gateway client closed")
	ErrDisconnected   = errors.New("openclaw gateway disconnected")
	ErrProtocol       = errors.New("openclaw gateway protocol error")
	ErrRequestTimeout = errors.New("openclaw gateway request timed out")
	errEventQueueFull = errors.New("openclaw gateway event queue full")
)

type GatewayConfig struct {
	URL              string
	Token            string
	RequestTimeout   time.Duration
	DevicePrivateKey ed25519.PrivateKey
	RequiredScopes   []string
}

type GatewayClient struct {
	config GatewayConfig
	dialer *websocket.Dialer

	mu                 sync.Mutex
	lifecycleMu        sync.Mutex
	connection         *gatewayConnection
	closed             bool
	subscribed         bool
	subscriptionWanted bool
	acceptEvents       bool
	requestID          uint64
	events             chan GatewayEvent
	disconnected       chan struct{}
	deviceToken        string
}

type gatewayConnection struct {
	conn      *websocket.Conn
	pending   map[string]*pendingRequest
	challenge chan string
	done      chan struct{}
	err       error
	failed    bool
	writeMu   sync.Mutex
}

type pendingRequest struct {
	result chan rpcResponse
}

type rpcResponse struct {
	payload json.RawMessage
	err     error
}

type rpcRequestFrame struct {
	Type   string      `json:"type"`
	ID     string      `json:"id"`
	Method string      `json:"method"`
	Params interface{} `json:"params,omitempty"`
}

type rpcResponseFrame struct {
	Type    string          `json:"type"`
	ID      string          `json:"id"`
	OK      bool            `json:"ok"`
	Payload json.RawMessage `json:"payload"`
	Error   *rpcErrorFrame  `json:"error"`
}

type rpcErrorFrame struct {
	Code         string          `json:"code"`
	Message      string          `json:"message"`
	Details      json.RawMessage `json:"details"`
	Retryable    bool            `json:"retryable"`
	RetryAfterMs int             `json:"retryAfterMs"`
}

type eventFrame struct {
	Type     string          `json:"type"`
	Event    string          `json:"event"`
	Payload  json.RawMessage `json:"payload"`
	Sequence int             `json:"seq"`
}

type RPCError struct {
	Code       string
	Message    string
	Retryable  bool
	RetryAfter time.Duration
}

func (e *RPCError) Error() string {
	return fmt.Sprintf("openclaw RPC %s: %s", e.Code, e.Message)
}

// AgentList is the Gateway's configured agent set. DefaultID is the agent a
// caller reaches by leaving the agent out of a session key, and it is not
// always "main": the Gateway picks the agent flagged default, else the first
// configured one. Read it rather than assuming either.
type AgentList struct {
	DefaultID string  `json:"defaultId"`
	MainKey   string  `json:"mainKey"`
	Agents    []Agent `json:"agents"`
}

type Agent struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ListSessionsParams struct {
	Limit  int `json:"limit,omitempty"`
	Offset int `json:"offset,omitempty"`
}

type SessionPage struct {
	Count      int       `json:"count"`
	TotalCount int       `json:"totalCount"`
	NextOffset *int      `json:"nextOffset"`
	HasMore    bool      `json:"hasMore"`
	Sessions   []Session `json:"sessions"`
}

type Session struct {
	Key          string `json:"key"`
	SessionID    string `json:"sessionId"`
	Label        string `json:"label"`
	DisplayName  string `json:"displayName"`
	UpdatedAt    int64  `json:"updatedAt"`
	HasActiveRun bool   `json:"hasActiveRun"`
}

type HistoryParams struct {
	SessionKey string `json:"sessionKey"`
	AgentID    string `json:"agentId,omitempty"`
	Limit      int    `json:"limit,omitempty"`
	Offset     int    `json:"offset,omitempty"`
	MaxChars   int    `json:"maxChars,omitempty"`
}

type HistoryPage struct {
	SessionKey    string          `json:"sessionKey"`
	SessionID     string          `json:"sessionId"`
	Offset        int             `json:"offset"`
	NextOffset    *int            `json:"nextOffset"`
	HasMore       bool            `json:"hasMore"`
	TotalMessages int             `json:"totalMessages"`
	Messages      []Message       `json:"messages"`
	Raw           json.RawMessage `json:"-"`
}

type Message struct {
	ID        string        `json:"-"`
	Role      string        `json:"role"`
	Content   []ContentPart `json:"content"`
	Timestamp int64         `json:"timestamp"`
}

// maxContentPartBytes caps one preserved part. A tool result can carry a whole
// file, and history is read in pages of many messages, so an unbounded part
// would let one command's output dominate a response.
const maxContentPartBytes = 16 * 1024

// ContentPart is one block of a message. Text is the common case, but a run's
// tool calls arrive as parts this package does not model; rather than drop
// them, the original JSON is kept and replayed verbatim so a caller can render
// a tool call without the Gateway's shape being duplicated here.
type ContentPart struct {
	Type string `json:"type"`
	Text string `json:"text"`
	// Raw is the part exactly as the Gateway sent it, set for every decoded
	// part and empty for parts this package constructs.
	Raw json.RawMessage `json:"-"`
	// Truncated reports that Raw exceeded the cap and was replaced by a
	// type-only stub, so a reader knows the block is not the whole story.
	Truncated bool `json:"-"`
}

func (p *ContentPart) UnmarshalJSON(data []byte) error {
	var shape struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(data, &shape); err != nil {
		return err
	}
	p.Type = shape.Type
	p.Text = shape.Text
	if len(data) > maxContentPartBytes {
		p.Raw = nil
		p.Truncated = true
		return nil
	}
	p.Raw = append(json.RawMessage(nil), data...)
	p.Truncated = false
	return nil
}

func (p ContentPart) MarshalJSON() ([]byte, error) {
	if p.Truncated {
		return json.Marshal(struct {
			Type      string `json:"type"`
			Truncated bool   `json:"truncated"`
		}{Type: p.Type, Truncated: true})
	}
	if len(p.Raw) > 0 {
		return p.Raw, nil
	}
	return json.Marshal(struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}{Type: p.Type, Text: p.Text})
}

func (m *Message) UnmarshalJSON(data []byte) error {
	var raw struct {
		Role      string          `json:"role"`
		Content   json.RawMessage `json:"content"`
		Timestamp int64           `json:"timestamp"`
		OpenClaw  struct {
			ID string `json:"id"`
		} `json:"__openclaw"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	m.ID = raw.OpenClaw.ID
	m.Role = raw.Role
	m.Timestamp = raw.Timestamp
	if len(raw.Content) == 0 || string(raw.Content) == "null" {
		return nil
	}
	var text string
	if err := json.Unmarshal(raw.Content, &text); err == nil {
		m.Content = []ContentPart{{Type: "text", Text: text}}
		return nil
	}
	return json.Unmarshal(raw.Content, &m.Content)
}

type SendMessageParams struct {
	SessionKey     string `json:"sessionKey"`
	AgentID        string `json:"agentId,omitempty"`
	SessionID      string `json:"sessionId,omitempty"`
	Message        string `json:"message"`
	Thinking       string `json:"thinking,omitempty"`
	Deliver        *bool  `json:"deliver,omitempty"`
	TimeoutMs      int    `json:"timeoutMs,omitempty"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type SendMessageResult struct {
	RunID  string `json:"runId"`
	Status string `json:"status"`
}

type PluginApprovalDecision string

const (
	DecisionAllowOnce PluginApprovalDecision = "allow-once"
	DecisionDeny      PluginApprovalDecision = "deny"
)

type PluginApproval struct {
	ID               string
	Title            string
	Description      string
	Severity         string
	ToolName         string
	AllowedDecisions []PluginApprovalDecision
	SessionKey       string
	CreatedAtMs      int64
	ExpiresAtMs      int64
}

type ResolvePluginApprovalParams struct {
	ID       string                 `json:"id"`
	Decision PluginApprovalDecision `json:"decision"`
}

type pluginApprovalRequest struct {
	Title            string                   `json:"title"`
	Description      string                   `json:"description"`
	Severity         string                   `json:"severity"`
	ToolName         string                   `json:"toolName"`
	AllowedDecisions []PluginApprovalDecision `json:"allowedDecisions"`
	SessionKey       string                   `json:"sessionKey"`
}

type pluginApprovalRecord struct {
	ID          string                `json:"id"`
	Request     pluginApprovalRequest `json:"request"`
	CreatedAtMs int64                 `json:"createdAtMs"`
	ExpiresAtMs int64                 `json:"expiresAtMs"`
}

type EventKind string

const (
	EventUnknown           EventKind = "unknown"
	EventChat              EventKind = "chat"
	EventActivity          EventKind = "activity"
	EventSessionsChanged   EventKind = "sessions.changed"
	EventApprovalRequested EventKind = "approval.requested"
	EventApprovalResolved  EventKind = "approval.resolved"
)

// Activity is one step the agent took while producing a reply: a tool call, a
// command, or a patch. The Gateway reports each step twice — a UI-shaped
// progress item and the raw tool result — so both are folded into one struct,
// joined by ToolCallID. Phase moves start → update → end for the same ItemID.
type Activity struct {
	ItemID     string
	ToolCallID string
	Phase      string
	Kind       string
	Name       string
	Title      string
	Status     string
	Summary    string
	Error      string
	Output     string
	StartedAt  int64
	EndedAt    int64
}

type GatewayEvent struct {
	Kind                 EventKind
	SessionKey           string
	RunID                string
	State                string
	DeltaText            string
	Reason               string
	ErrorKind            string
	ErrorMessage         string
	StopReason           string
	SpawnedBy            string
	Sequence             int
	EnvelopeSequence     int
	Message              *Message
	Activity             *Activity
	Approval             *PluginApproval
	ApprovalDecision     PluginApprovalDecision
	ApprovalResolvedBy   string
	ApprovalResolvedAtMs int64
	Payload              json.RawMessage `json:"-"`
}

func NewGatewayClient(ctx context.Context, config GatewayConfig) (*GatewayClient, error) {
	client, err := NewDisconnectedGatewayClient(config)
	if err != nil {
		return nil, err
	}
	if err := client.Reconnect(ctx); err != nil {
		return nil, err
	}
	return client, nil
}

// NewDisconnectedGatewayClient creates a client whose first connection is
// established by Reconnect.
func NewDisconnectedGatewayClient(config GatewayConfig) (*GatewayClient, error) {
	if config.URL == "" {
		return nil, fmt.Errorf("openclaw gateway URL is required")
	}
	if config.RequestTimeout <= 0 {
		config.RequestTimeout = 10 * time.Second
	}
	return &GatewayClient{
		config:       config,
		dialer:       websocket.DefaultDialer,
		events:       make(chan GatewayEvent, 64),
		disconnected: make(chan struct{}, 1),
	}, nil
}

func (c *GatewayClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	payload, err := c.call(ctx, method, params)
	if err != nil {
		return nil, err
	}
	return append(json.RawMessage(nil), payload...), nil
}

func (c *GatewayClient) ListAgents(ctx context.Context) (AgentList, error) {
	payload, err := c.call(ctx, "agents.list", struct{}{})
	if err != nil {
		return AgentList{}, err
	}
	var list AgentList
	if err := json.Unmarshal(payload, &list); err != nil {
		return AgentList{}, fmt.Errorf("%w: decode agents.list response: %v", ErrProtocol, err)
	}
	return list, nil
}

func (c *GatewayClient) ListPluginApprovals(ctx context.Context) ([]PluginApproval, error) {
	payload, err := c.call(ctx, "plugin.approval.list", struct{}{})
	if err != nil {
		return nil, err
	}
	var records []pluginApprovalRecord
	if err := json.Unmarshal(payload, &records); err != nil {
		var legacyResponse struct {
			Pending []pluginApprovalRecord `json:"pending"`
		}
		if legacyErr := json.Unmarshal(payload, &legacyResponse); legacyErr != nil {
			return nil, fmt.Errorf("%w: decode plugin.approval.list response: %v", ErrProtocol, err)
		}
		records = legacyResponse.Pending
	}
	approvals := make([]PluginApproval, 0, len(records))
	for _, record := range records {
		approval, err := validatePluginApprovalRecord(record, true)
		if err != nil {
			return nil, err
		}
		approvals = append(approvals, approval)
	}
	return approvals, nil
}

func (c *GatewayClient) ResolvePluginApproval(ctx context.Context, params ResolvePluginApprovalParams) error {
	if strings.TrimSpace(params.ID) == "" || !validPluginApprovalDecision(params.Decision) {
		return fmt.Errorf("%w: invalid plugin approval resolution", ErrProtocol)
	}
	_, err := c.call(ctx, "plugin.approval.resolve", params)
	return err
}

func (c *GatewayClient) ListSessions(ctx context.Context, params ListSessionsParams) (SessionPage, error) {
	payload, err := c.call(ctx, "sessions.list", params)
	if err != nil {
		return SessionPage{}, err
	}
	var page SessionPage
	if err := json.Unmarshal(payload, &page); err != nil {
		return SessionPage{}, fmt.Errorf("%w: decode sessions.list response: %v", ErrProtocol, err)
	}
	return page, nil
}

func (c *GatewayClient) History(ctx context.Context, params HistoryParams) (HistoryPage, error) {
	payload, err := c.call(ctx, "chat.history", params)
	if err != nil {
		return HistoryPage{}, err
	}
	var page HistoryPage
	if err := json.Unmarshal(payload, &page); err != nil {
		return HistoryPage{}, fmt.Errorf("%w: decode chat.history response: %v", ErrProtocol, err)
	}
	page.Raw = append(json.RawMessage(nil), payload...)
	return page, nil
}

func (c *GatewayClient) SendMessage(ctx context.Context, params SendMessageParams) (SendMessageResult, error) {
	payload, err := c.call(ctx, "chat.send", params)
	if err != nil {
		return SendMessageResult{}, err
	}
	var result SendMessageResult
	if err := json.Unmarshal(payload, &result); err != nil {
		return SendMessageResult{}, fmt.Errorf("%w: decode chat.send response: %v", ErrProtocol, err)
	}
	return result, nil
}

func (c *GatewayClient) Subscribe(ctx context.Context) (<-chan GatewayEvent, error) {
	c.lifecycleMu.Lock()
	defer c.lifecycleMu.Unlock()
	return c.subscribe(ctx)
}

func (c *GatewayClient) subscribe(ctx context.Context) (<-chan GatewayEvent, error) {
	c.mu.Lock()
	alreadySubscribed := c.subscribed
	conn := c.connection
	if !alreadySubscribed && conn != nil {
		c.acceptEvents = true
	}
	c.mu.Unlock()
	if alreadySubscribed {
		return c.events, nil
	}
	if conn == nil {
		return nil, ErrDisconnected
	}
	if _, err := c.callOnConnection(ctx, conn, "sessions.subscribe", map[string]interface{}{}); err != nil {
		c.mu.Lock()
		if c.connection == conn {
			c.subscribed = false
			c.acceptEvents = false
		}
		c.mu.Unlock()
		return nil, err
	}
	c.mu.Lock()
	c.subscriptionWanted = true
	if c.connection == conn && !conn.failed {
		c.subscribed = true
	}
	c.mu.Unlock()
	return c.events, nil
}

func (c *GatewayClient) Reconnect(ctx context.Context) error {
	c.lifecycleMu.Lock()
	defer c.lifecycleMu.Unlock()
	c.mu.Lock()
	wantsSubscription := c.subscriptionWanted
	c.mu.Unlock()
	if err := c.connect(ctx); err != nil {
		return err
	}
	if !wantsSubscription {
		return nil
	}
	_, err := c.subscribe(ctx)
	return err
}

func (c *GatewayClient) Disconnected() <-chan struct{} {
	return c.disconnected
}

func (c *GatewayClient) Close() error {
	c.lifecycleMu.Lock()
	defer c.lifecycleMu.Unlock()
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return ErrClosed
	}
	c.closed = true
	conn := c.connection
	c.connection = nil
	c.subscribed = false
	c.acceptEvents = false
	c.mu.Unlock()
	if conn != nil {
		c.failConnection(conn, ErrClosed)
	}
	return nil
}

func (c *GatewayClient) connect(ctx context.Context) error {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return ErrClosed
	}
	c.mu.Unlock()

	conn, _, err := c.dialer.DialContext(ctx, c.config.URL, nil)
	if err != nil {
		return err
	}
	state := &gatewayConnection{
		conn:      conn,
		pending:   make(map[string]*pendingRequest),
		challenge: make(chan string, 1),
		done:      make(chan struct{}),
	}
	go c.readLoop(state)
	nonce, err := c.waitForChallenge(ctx, state)
	if err != nil {
		c.failConnection(state, err)
		return err
	}
	params, err := c.connectParams(nonce)
	if err != nil {
		c.failConnection(state, err)
		return err
	}
	payload, err := c.callOnConnection(ctx, state, "connect", params)
	if err != nil {
		c.failConnection(state, err)
		return err
	}
	deviceToken, err := c.validateHello(payload)
	if err != nil {
		c.failConnection(state, err)
		return err
	}
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		c.failConnection(state, ErrClosed)
		return ErrClosed
	}
	if state.failed && errors.Is(state.err, errEventQueueFull) {
		err := state.err
		c.mu.Unlock()
		return err
	}
	previous := c.connection
	c.connection = state
	c.subscribed = false
	c.acceptEvents = false
	c.deviceToken = deviceToken
	c.mu.Unlock()
	if previous != nil {
		c.failConnection(previous, ErrDisconnected)
	}
	return nil
}

func (c *GatewayClient) waitForChallenge(ctx context.Context, conn *gatewayConnection) (string, error) {
	select {
	case nonce := <-conn.challenge:
		if nonce == "" {
			return "", fmt.Errorf("%w: connect challenge missing nonce", ErrProtocol)
		}
		return nonce, nil
	case <-conn.done:
		return "", conn.err
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// requestedScopes are the scopes this client asks the Gateway to grant. It
// is the single source of truth for both wire-format copies: the connect
// params "scopes" array and the comma-joined scope list inside the v3
// device-proof signature payload, which the Gateway rebuilds in exactly the
// order the array was sent.
//
// When RequiredScopes is empty the package default is used rather than an
// empty scope set: an empty request would make the Gateway grant nothing,
// and callers that do configure required scopes would then be rejected by
// validateHello against their own connection.
func (c *GatewayClient) requestedScopes() []string {
	if len(c.config.RequiredScopes) == 0 {
		return RequiredOperatorScopes
	}
	return c.config.RequiredScopes
}

func (c *GatewayClient) connectParams(nonce string) (map[string]interface{}, error) {
	scopes := c.requestedScopes()
	params := map[string]interface{}{
		"minProtocol": gatewayProtocolVersion,
		"maxProtocol": gatewayProtocolVersion,
		"client": map[string]string{
			"id":          gatewayClientID,
			"displayName": gatewayClientDisplayName,
			"version":     "cloudhub",
			"platform":    runtime.GOOS,
			"mode":        gatewayClientMode,
		},
		"caps":   []string{gatewayToolEventsCap},
		"role":   "operator",
		"auth":   map[string]string{"token": c.config.Token},
		"scopes": scopes,
	}
	if len(c.config.DevicePrivateKey) == 0 {
		return params, nil
	}
	if len(c.config.DevicePrivateKey) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("%w: invalid device private key", ErrProtocol)
	}
	publicKey := c.config.DevicePrivateKey.Public().(ed25519.PublicKey)
	deviceID := fmt.Sprintf("%x", sha256.Sum256(publicKey))
	signedAt := time.Now().UnixMilli()
	payload := fmt.Sprintf("v3|%s|%s|%s|operator|%s|%d|%s|%s|%s|", deviceID, gatewayClientID, gatewayClientMode, strings.Join(scopes, ","), signedAt, c.config.Token, nonce, strings.ToLower(runtime.GOOS))
	params["device"] = map[string]interface{}{
		"id":        deviceID,
		"publicKey": base64.RawURLEncoding.EncodeToString(publicKey),
		"signature": base64.RawURLEncoding.EncodeToString(ed25519.Sign(c.config.DevicePrivateKey, []byte(payload))),
		"signedAt":  signedAt,
		"nonce":     nonce,
	}
	return params, nil
}

func (c *GatewayClient) call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil, ErrClosed
	}
	conn := c.connection
	c.mu.Unlock()
	if conn == nil {
		return nil, ErrDisconnected
	}
	return c.callOnConnection(ctx, conn, method, params)
}

func (c *GatewayClient) callOnConnection(ctx context.Context, conn *gatewayConnection, method string, params interface{}) (json.RawMessage, error) {
	id := fmt.Sprintf("%d", atomic.AddUint64(&c.requestID, 1))
	pending := &pendingRequest{result: make(chan rpcResponse, 1)}
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil, ErrClosed
	}
	if conn.failed {
		err := conn.err
		c.mu.Unlock()
		return nil, err
	}
	conn.pending[id] = pending
	c.mu.Unlock()

	if err := c.write(conn, rpcRequestFrame{Type: "req", ID: id, Method: method, Params: params}); err != nil {
		c.removePending(conn, id, pending)
		c.failConnection(conn, fmt.Errorf("%w: %v", ErrDisconnected, err))
		return nil, fmt.Errorf("%w: %v", ErrDisconnected, err)
	}

	timer := time.NewTimer(c.config.RequestTimeout)
	defer timer.Stop()
	select {
	case response := <-pending.result:
		return response.payload, response.err
	case <-ctx.Done():
		c.removePending(conn, id, pending)
		return nil, ctx.Err()
	case <-timer.C:
		c.removePending(conn, id, pending)
		return nil, ErrRequestTimeout
	}
}

func (c *GatewayClient) write(conn *gatewayConnection, frame rpcRequestFrame) error {
	conn.writeMu.Lock()
	defer conn.writeMu.Unlock()
	return conn.conn.WriteJSON(frame)
}

func (c *GatewayClient) readLoop(conn *gatewayConnection) {
	for {
		_, data, err := conn.conn.ReadMessage()
		if err != nil {
			c.failConnection(conn, fmt.Errorf("%w: %v", ErrDisconnected, err))
			return
		}
		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(data, &envelope); err != nil || envelope.Type == "" {
			c.failConnection(conn, fmt.Errorf("%w: invalid frame", ErrProtocol))
			return
		}
		switch envelope.Type {
		case "res":
			var response rpcResponseFrame
			if err := json.Unmarshal(data, &response); err != nil || response.ID == "" {
				c.failConnection(conn, fmt.Errorf("%w: invalid response frame", ErrProtocol))
				return
			}
			c.deliverResponse(conn, response)
		case "event":
			var event eventFrame
			if err := json.Unmarshal(data, &event); err != nil || event.Event == "" {
				c.failConnection(conn, fmt.Errorf("%w: invalid event frame", ErrProtocol))
				return
			}
			if event.Event == "connect.challenge" {
				var challenge struct {
					Nonce string `json:"nonce"`
				}
				if err := json.Unmarshal(event.Payload, &challenge); err != nil || strings.TrimSpace(challenge.Nonce) == "" {
					c.failConnection(conn, fmt.Errorf("%w: connect challenge missing nonce", ErrProtocol))
					return
				}
				select {
				case conn.challenge <- strings.TrimSpace(challenge.Nonce):
				default:
				}
				continue
			}
			if normalized, ok := normalizeEvent(event); ok {
				c.mu.Lock()
				acceptEvents := c.acceptEvents
				c.mu.Unlock()
				if !acceptEvents {
					continue
				}
				select {
				case c.events <- normalized:
				default:
					c.failConnection(conn, fmt.Errorf("%w: %w", ErrDisconnected, errEventQueueFull))
					return
				}
			}
		default:
			c.failConnection(conn, fmt.Errorf("%w: unsupported frame type %q", ErrProtocol, envelope.Type))
			return
		}
	}
}

func (c *GatewayClient) deliverResponse(conn *gatewayConnection, response rpcResponseFrame) {
	c.mu.Lock()
	pending := conn.pending[response.ID]
	delete(conn.pending, response.ID)
	c.mu.Unlock()
	if pending == nil {
		return
	}
	if !response.OK {
		if response.Error == nil || response.Error.Code == "" || response.Error.Message == "" {
			pending.result <- rpcResponse{err: fmt.Errorf("%w: invalid RPC error response", ErrProtocol)}
			return
		}
		pending.result <- rpcResponse{err: &RPCError{
			Code:       response.Error.Code,
			Message:    response.Error.Message,
			Retryable:  response.Error.Retryable,
			RetryAfter: time.Duration(response.Error.RetryAfterMs) * time.Millisecond,
		}}
		return
	}
	pending.result <- rpcResponse{payload: response.Payload}
}

func (c *GatewayClient) removePending(conn *gatewayConnection, id string, pending *pendingRequest) {
	c.mu.Lock()
	if conn.pending[id] == pending {
		delete(conn.pending, id)
	}
	c.mu.Unlock()
}

func (c *GatewayClient) failConnection(conn *gatewayConnection, err error) {
	c.mu.Lock()
	if conn.failed {
		c.mu.Unlock()
		return
	}
	conn.failed = true
	conn.err = err
	close(conn.done)
	pending := conn.pending
	conn.pending = make(map[string]*pendingRequest)
	wasCurrent := c.connection == conn
	if wasCurrent {
		c.connection = nil
		c.subscribed = false
		c.acceptEvents = false
	}
	c.mu.Unlock()
	_ = conn.conn.Close()
	if wasCurrent {
		select {
		case c.disconnected <- struct{}{}:
		default:
		}
	}
	for _, request := range pending {
		request.result <- rpcResponse{err: err}
	}
}

type helloPayload struct {
	Type     string `json:"type"`
	Protocol int    `json:"protocol"`
	Auth     struct {
		Role        string   `json:"role"`
		Scopes      []string `json:"scopes"`
		DeviceToken string   `json:"deviceToken"`
	} `json:"auth"`
}

func (c *GatewayClient) validateHello(payload json.RawMessage) (string, error) {
	var hello helloPayload
	if err := json.Unmarshal(payload, &hello); err != nil || hello.Type != "hello-ok" || hello.Protocol != gatewayProtocolVersion {
		return "", fmt.Errorf("%w: expected hello-ok protocol %d", ErrProtocol, gatewayProtocolVersion)
	}
	if hello.Auth.Role != "operator" {
		return "", fmt.Errorf("%w: hello-ok role %q, want operator", ErrProtocol, hello.Auth.Role)
	}
	granted := make(map[string]bool, len(hello.Auth.Scopes))
	for _, scope := range hello.Auth.Scopes {
		granted[scope] = true
	}
	for _, required := range c.config.RequiredScopes {
		if !granted[required] {
			return "", fmt.Errorf("%w: hello-ok missing required scope %q", ErrProtocol, required)
		}
	}
	return hello.Auth.DeviceToken, nil
}

// DeviceToken returns the device token from the most recent successful
// hello-ok response, if the Gateway issued one. It is empty on ordinary
// reconnects where the Gateway does not reissue a token. It is used by the
// provisioner to capture a newly issued token; it is never logged.
func (c *GatewayClient) DeviceToken() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.deviceToken
}

func normalizeEvent(frame eventFrame) (GatewayEvent, bool) {
	switch frame.Event {
	case "connect.challenge", "tick":
		return GatewayEvent{}, false
	case "chat":
		var payload struct {
			SessionKey   string   `json:"sessionKey"`
			RunID        string   `json:"runId"`
			State        string   `json:"state"`
			DeltaText    string   `json:"deltaText"`
			ErrorKind    string   `json:"errorKind"`
			ErrorMessage string   `json:"errorMessage"`
			StopReason   string   `json:"stopReason"`
			Sequence     int      `json:"seq"`
			Message      *Message `json:"message"`
		}
		if err := json.Unmarshal(frame.Payload, &payload); err != nil {
			return GatewayEvent{}, false
		}
		rawPayload := boundedEventPayload(frame.Payload)
		return GatewayEvent{Kind: EventChat, SessionKey: payload.SessionKey, RunID: payload.RunID, State: payload.State, DeltaText: payload.DeltaText, ErrorKind: payload.ErrorKind, ErrorMessage: payload.ErrorMessage, StopReason: payload.StopReason, Sequence: payload.Sequence, EnvelopeSequence: frame.Sequence, Message: payload.Message, Payload: rawPayload}, true
	case "sessions.changed":
		var payload struct {
			SessionKey string `json:"sessionKey"`
			Reason     string `json:"reason"`
		}
		if err := json.Unmarshal(frame.Payload, &payload); err != nil {
			return GatewayEvent{}, false
		}
		return GatewayEvent{Kind: EventSessionsChanged, SessionKey: payload.SessionKey, Reason: payload.Reason, EnvelopeSequence: frame.Sequence}, true
	case "agent":
		var payload struct {
			SessionKey string          `json:"sessionKey"`
			RunID      string          `json:"runId"`
			SpawnedBy  string          `json:"spawnedBy"`
			Stream     string          `json:"stream"`
			Sequence   int             `json:"seq"`
			Data       json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(frame.Payload, &payload); err != nil {
			return GatewayEvent{}, false
		}
		activity := normalizeActivity(payload.Stream, payload.Data)
		if activity == nil {
			return GatewayEvent{Kind: EventUnknown, EnvelopeSequence: frame.Sequence}, true
		}
		rawPayload := boundedEventPayload(frame.Payload)
		return GatewayEvent{Kind: EventActivity, SessionKey: payload.SessionKey, RunID: payload.RunID, SpawnedBy: payload.SpawnedBy, Sequence: payload.Sequence, EnvelopeSequence: frame.Sequence, Activity: activity, Payload: rawPayload}, true
	case "plugin.approval.requested":
		var record pluginApprovalRecord
		if err := json.Unmarshal(frame.Payload, &record); err != nil {
			return GatewayEvent{}, false
		}
		approval, err := validatePluginApprovalRecord(record, true)
		if err != nil {
			return GatewayEvent{}, false
		}
		return GatewayEvent{
			Kind:             EventApprovalRequested,
			SessionKey:       approval.SessionKey,
			EnvelopeSequence: frame.Sequence,
			Approval:         &approval,
			Payload:          boundedEventPayload(frame.Payload),
		}, true
	case "plugin.approval.resolved":
		var payload struct {
			ID         string                 `json:"id"`
			Decision   PluginApprovalDecision `json:"decision"`
			ResolvedBy string                 `json:"resolvedBy"`
			Timestamp  int64                  `json:"ts"`
			Request    pluginApprovalRequest  `json:"request"`
		}
		if err := json.Unmarshal(frame.Payload, &payload); err != nil ||
			strings.TrimSpace(payload.ResolvedBy) == "" || payload.Timestamp <= 0 ||
			!validPluginApprovalDecision(payload.Decision) {
			return GatewayEvent{}, false
		}
		approval, err := validatePluginApprovalRecord(pluginApprovalRecord{
			ID: payload.ID, Request: payload.Request,
		}, false)
		if err != nil {
			return GatewayEvent{}, false
		}
		return GatewayEvent{
			Kind:                 EventApprovalResolved,
			SessionKey:           approval.SessionKey,
			EnvelopeSequence:     frame.Sequence,
			Approval:             &approval,
			ApprovalDecision:     payload.Decision,
			ApprovalResolvedBy:   payload.ResolvedBy,
			ApprovalResolvedAtMs: payload.Timestamp,
			Payload:              boundedEventPayload(frame.Payload),
		}, true
	default:
		return GatewayEvent{Kind: EventUnknown, EnvelopeSequence: frame.Sequence}, true
	}
}

const maxGatewayEventPayloadBytes = 64 * 1024

func boundedEventPayload(payload json.RawMessage) json.RawMessage {
	if len(payload) > maxGatewayEventPayloadBytes {
		return nil
	}
	return append(json.RawMessage(nil), payload...)
}

func validatePluginApprovalRecord(record pluginApprovalRecord, requireTimestamps bool) (PluginApproval, error) {
	request := record.Request
	if strings.TrimSpace(record.ID) == "" || strings.TrimSpace(request.SessionKey) == "" ||
		utf8.RuneCountInString(request.Title) > 80 || utf8.RuneCountInString(request.Description) > 256 ||
		(requireTimestamps && (strings.TrimSpace(request.ToolName) == "" || len(request.AllowedDecisions) == 0)) {
		return PluginApproval{}, fmt.Errorf("%w: invalid plugin approval record", ErrProtocol)
	}
	for _, decision := range request.AllowedDecisions {
		if !validPluginApprovalDecision(decision) {
			return PluginApproval{}, fmt.Errorf("%w: invalid plugin approval decision %q", ErrProtocol, decision)
		}
	}
	if requireTimestamps && (record.CreatedAtMs <= 0 || record.ExpiresAtMs <= record.CreatedAtMs) {
		return PluginApproval{}, fmt.Errorf("%w: invalid plugin approval timestamps", ErrProtocol)
	}
	return PluginApproval{
		ID:               record.ID,
		Title:            request.Title,
		Description:      request.Description,
		Severity:         request.Severity,
		ToolName:         request.ToolName,
		AllowedDecisions: append([]PluginApprovalDecision(nil), request.AllowedDecisions...),
		SessionKey:       request.SessionKey,
		CreatedAtMs:      record.CreatedAtMs,
		ExpiresAtMs:      record.ExpiresAtMs,
	}, nil
}

func validPluginApprovalDecision(decision PluginApprovalDecision) bool {
	return decision == DecisionAllowOnce || decision == DecisionDeny
}

// normalizeActivity keeps the two agent streams that describe a run's steps and
// drops the rest. The "item" stream is the Gateway's own display projection —
// title, status, timings — so it carries progress, while the "tool" stream is
// taken only for its result, reported as an "output" phase against the same
// item. Every other stream reports internals no chat client can act on, and a
// nil return leaves them unknown to callers.
func normalizeActivity(stream string, data json.RawMessage) *Activity {
	if len(data) == 0 {
		return nil
	}
	switch stream {
	case "item":
		var raw struct {
			ItemID       string `json:"itemId"`
			ToolCallID   string `json:"toolCallId"`
			Phase        string `json:"phase"`
			Kind         string `json:"kind"`
			Name         string `json:"name"`
			Title        string `json:"title"`
			Status       string `json:"status"`
			Summary      string `json:"summary"`
			ProgressText string `json:"progressText"`
			Error        string `json:"error"`
			StartedAt    int64  `json:"startedAt"`
			EndedAt      int64  `json:"endedAt"`
		}
		if err := json.Unmarshal(data, &raw); err != nil || raw.ItemID == "" || raw.Phase == "" {
			return nil
		}
		summary := raw.Summary
		if summary == "" {
			summary = raw.ProgressText
		}
		return &Activity{
			ItemID:     raw.ItemID,
			ToolCallID: raw.ToolCallID,
			Phase:      raw.Phase,
			Kind:       raw.Kind,
			Name:       raw.Name,
			Title:      raw.Title,
			Status:     raw.Status,
			Summary:    summary,
			Error:      raw.Error,
			StartedAt:  raw.StartedAt,
			EndedAt:    raw.EndedAt,
		}
	case "tool":
		var raw struct {
			Phase            string          `json:"phase"`
			Name             string          `json:"name"`
			ToolCallID       string          `json:"toolCallId"`
			IsError          bool            `json:"isError"`
			ToolErrorSummary string          `json:"toolErrorSummary"`
			Result           json.RawMessage `json:"result"`
		}
		if err := json.Unmarshal(data, &raw); err != nil || raw.Phase != "result" || raw.ToolCallID == "" {
			return nil
		}
		return &Activity{
			ItemID:     "tool:" + raw.ToolCallID,
			ToolCallID: raw.ToolCallID,
			Phase:      "output",
			Kind:       "tool",
			Name:       raw.Name,
			Error:      raw.ToolErrorSummary,
			Output:     activityOutput(raw.Result),
		}
	default:
		return nil
	}
}

// activityOutput renders a tool result as the text a reader sees. The Gateway
// returns either a bare string or content blocks; anything else is passed
// through as its own JSON rather than dropped, because a result the agent acted
// on is evidence even when its shape is unfamiliar.
func activityOutput(result json.RawMessage) string {
	if len(result) == 0 || string(result) == "null" {
		return ""
	}
	var text string
	if err := json.Unmarshal(result, &text); err == nil {
		return text
	}
	var blocks struct {
		Content []ContentPart `json:"content"`
	}
	if err := json.Unmarshal(result, &blocks); err == nil && len(blocks.Content) > 0 {
		texts := make([]string, 0, len(blocks.Content))
		for _, part := range blocks.Content {
			if part.Text != "" {
				texts = append(texts, part.Text)
			}
		}
		if len(texts) > 0 {
			return strings.Join(texts, "\n")
		}
	}
	return string(result)
}
