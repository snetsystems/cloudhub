package server

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/hubble"
	"github.com/snetsystems/cloudhub/backend/influx"
	"github.com/snetsystems/cloudhub/backend/kubernetes"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

// Service handles REST calls to the persistence
type Service struct {
	Store                     DataStore
	TimeSeriesClient          TimeSeriesClient
	Logger                    cloudhub.Logger
	UseAuth                   bool
	SuperAdminProviderGroups  superAdminProviderGroups
	Env                       cloudhub.Environment
	Databases                 cloudhub.Databases
	MailSubject               string
	MailBody                  string
	ExternalExec              string
	ExternalExecArgs          string
	LoginAuthType             string
	BasicPasswordResetType    string
	RetryPolicy               map[string]string
	AddonURLs                 map[string]string // URLs for using in Addon Features, as passed in via CLI/ENV
	AddonTokens               map[string]string // Tokens to access to Addon Features API, as passed in via CLI/ENV
	OSP                       OSP
	InternalENV               cloudhub.InternalEnvironment
	KubernetesClient          *kubernetes.Client
	KafkaProducer             KafkaProducer
	HubbleManager             *hubble.Manager
	HubbleSnapshotInterval    time.Duration
	RecipientGroups           cloudhub.RecipientGroupStore
	AlertRecipientGroups      cloudhub.AlertRecipientGroupStore
	AlertRecipientMemberPrefs cloudhub.AlertRecipientMemberPrefsStore
	AlertKapacitors           cloudhub.AlertKapacitorStore
	AlertKapacitorMappings    cloudhub.AlertKapacitorMappingStore
	AlertGroupRules           cloudhub.AlertGroupRuleStore
	AlertTemplates            cloudhub.AlertTemplatesStore
	OpenClawGateway           openClawGateway
	OpenClawAgentID           string
}

// KafkaProducer defines the interface for publishing configuration updates
type KafkaProducer interface {
	PublishConfig(shardID int, configContent string) error
	Close() error
}

type superAdminProviderGroups struct {
	auth0 string
}

// TimeSeriesClient returns the correct client for a time series database.
// todo(glinton): should this be always reconnecting?
type TimeSeriesClient interface {
	New(cloudhub.Source, cloudhub.Logger) (cloudhub.TimeSeries, error)
}

// ErrorMessage is the error response format for all service errors
type ErrorMessage struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ErrorMessageBasic is the error response format for basic login service errors
type ErrorMessageBasic struct {
	Code       int    `json:"code"`
	Message    string `json:"message"`
	RetryCount int32  `json:"retryCount"`
	LockedTime string `json:"lockedTime"`
	Locked     bool   `json:"locked"`
}

// TimeSeries returns a new client connected to a time series database
func (s *Service) TimeSeries(src cloudhub.Source) (cloudhub.TimeSeries, error) {
	return s.TimeSeriesClient.New(src, s.Logger)
}

// InfluxClient returns a new client to connect to OSS
type InfluxClient struct{}

// New creates a client to connect to OSS
func (c *InfluxClient) New(src cloudhub.Source, logger cloudhub.Logger) (cloudhub.TimeSeries, error) {
	client := &influx.Client{
		Logger: logger,
	}
	if err := client.Connect(context.TODO(), &src); err != nil {
		return nil, err
	}

	return client, nil
}

// openClawGateway is the narrow Gateway client surface used by chat handlers.
// The concrete client is wired during server startup.
type openClawGateway interface {
	Call(context.Context, string, interface{}) (json.RawMessage, error)
	History(context.Context, openclaw.HistoryParams) (openclaw.HistoryPage, error)
	SendMessage(context.Context, openclaw.SendMessageParams) (openclaw.SendMessageResult, error)
	Subscribe(context.Context) (<-chan openclaw.GatewayEvent, error)
	ListAgents(context.Context) (openclaw.AgentList, error)
}

var _ openClawGateway = (*openclaw.GatewayClient)(nil)

// openClawGatewayLifecycle is the additional client surface owned by the
// process-wide lifecycle manager.
type openClawGatewayLifecycle interface {
	openClawGateway
	Reconnect(context.Context) error
	Disconnected() <-chan struct{}
	Close() error
}

const (
	openClawReconnectInitialBackoff = 100 * time.Millisecond
	openClawReconnectMaxBackoff     = 5 * time.Second
)

// openClawGatewayManager keeps the single Gateway client connected for this
// CloudHub process. GatewayClient preserves subscription intent while it
// reconnects; the manager supplies the retry policy and tells web clients to
// refresh their history once the connection is restored.
type openClawGatewayManager struct {
	gateway openClawGatewayLifecycle

	ctx    context.Context
	cancel context.CancelFunc

	reconnectInitialBackoff time.Duration
	reconnectMaxBackoff     time.Duration

	eventsMu        sync.Mutex
	events          <-chan openclaw.GatewayEvent
	forwardedEvents chan openclaw.GatewayEvent
	forwarding      bool

	closeOnce sync.Once
	closeErr  error
}

func newOpenClawGatewayManager(ctx context.Context, gateway openClawGatewayLifecycle) *openClawGatewayManager {
	managerCtx, cancel := context.WithCancel(ctx)
	manager := &openClawGatewayManager{
		gateway:                 gateway,
		ctx:                     managerCtx,
		cancel:                  cancel,
		reconnectInitialBackoff: openClawReconnectInitialBackoff,
		reconnectMaxBackoff:     openClawReconnectMaxBackoff,
		forwardedEvents:         make(chan openclaw.GatewayEvent, 64),
	}
	go manager.run()
	return manager
}

func (m *openClawGatewayManager) History(ctx context.Context, params openclaw.HistoryParams) (openclaw.HistoryPage, error) {
	return m.gateway.History(ctx, params)
}

func (m *openClawGatewayManager) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	return m.gateway.Call(ctx, method, params)
}

func (m *openClawGatewayManager) SendMessage(ctx context.Context, params openclaw.SendMessageParams) (openclaw.SendMessageResult, error) {
	return m.gateway.SendMessage(ctx, params)
}

func (m *openClawGatewayManager) ListAgents(ctx context.Context) (openclaw.AgentList, error) {
	return m.gateway.ListAgents(ctx)
}

func (m *openClawGatewayManager) Subscribe(ctx context.Context) (<-chan openclaw.GatewayEvent, error) {
	m.eventsMu.Lock()
	defer m.eventsMu.Unlock()
	if m.events == nil {
		events, err := m.gateway.Subscribe(ctx)
		if err != nil {
			return nil, err
		}
		m.events = events
		m.forwarding = true
		go m.forward(events)
	}
	return m.forwardedEvents, nil
}

func (m *openClawGatewayManager) Close() error {
	m.closeOnce.Do(func() {
		m.cancel()
		m.closeErr = m.gateway.Close()
	})
	return m.closeErr
}

func (m *openClawGatewayManager) run() {
	for {
		select {
		case <-m.ctx.Done():
			_ = m.Close()
			return
		case <-m.gateway.Disconnected():
			if m.reconnect() {
				m.publishResync()
			}
		}
	}
}

func (m *openClawGatewayManager) reconnect() bool {
	backoff := m.reconnectInitialBackoff
	for {
		if err := m.gateway.Reconnect(m.ctx); err == nil {
			return true
		}
		select {
		case <-m.ctx.Done():
			return false
		case <-time.After(backoff):
		}
		backoff *= 2
		if backoff > m.reconnectMaxBackoff {
			backoff = m.reconnectMaxBackoff
		}
	}
}

func (m *openClawGatewayManager) forward(events <-chan openclaw.GatewayEvent) {
	for {
		select {
		case <-m.ctx.Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			select {
			case m.forwardedEvents <- event:
			case <-m.ctx.Done():
				return
			}
		}
	}
}

func (m *openClawGatewayManager) publishResync() {
	m.eventsMu.Lock()
	forwarding := m.forwarding
	m.eventsMu.Unlock()
	if !forwarding {
		return
	}
	select {
	case m.forwardedEvents <- openclaw.GatewayEvent{Kind: openclaw.EventSessionsChanged, Reason: "resync"}:
	case <-m.ctx.Done():
	}
}

var _ openClawGateway = (*openClawGatewayManager)(nil)
