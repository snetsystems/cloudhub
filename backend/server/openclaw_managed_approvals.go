package server

import (
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/snetsystems/cloudhub/backend/id"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

type openClawManagedApprovalState string

const (
	openClawManagedApprovalPending openClawManagedApprovalState = "pending"
	openClawManagedApprovalAllowed openClawManagedApprovalState = "allowed"
	openClawManagedApprovalDenied  openClawManagedApprovalState = "denied"
	openClawManagedApprovalExpired openClawManagedApprovalState = "expired"

	openClawManagedApprovalRetention = 5 * time.Minute
)

var (
	errOpenClawManagedApprovalNotFound = errors.New("managed approval not found")
	errOpenClawManagedApprovalConflict = errors.New("managed approval conflict")
	errOpenClawManagedApprovalInvalid  = errors.New("invalid managed approval")
)

type openClawManagedApprovalCreate struct {
	SessionKey     string
	ToolName       string
	ToolCallID     string
	IdempotencyKey string
	Title          string
	Description    string
	Severity       string
	Timeout        time.Duration
}

type openClawManagedApproval struct {
	ID               string
	SessionKey       string
	ToolName         string
	ToolCallID       string
	IdempotencyKey   string
	Title            string
	Description      string
	Severity         string
	AllowedDecisions []openclaw.PluginApprovalDecision
	State            openClawManagedApprovalState
	Decision         openclaw.PluginApprovalDecision
	CreatedAtMs      int64
	ExpiresAtMs      int64
	ResolvedAtMs     int64
	requestIdentity  string
}

type openClawManagedApprovalStore struct {
	mu          sync.Mutex
	now         func() time.Time
	byID        map[string]openClawManagedApproval
	byRequestID map[string]string
}

func newOpenClawManagedApprovalStore(now func() time.Time) *openClawManagedApprovalStore {
	if now == nil {
		now = time.Now
	}
	return &openClawManagedApprovalStore{
		now:         now,
		byID:        make(map[string]openClawManagedApproval),
		byRequestID: make(map[string]string),
	}
}

func (s *openClawManagedApprovalStore) Create(request openClawManagedApprovalCreate) (openClawManagedApproval, bool, error) {
	identityValue := strings.TrimSpace(request.ToolCallID)
	if identityValue == "" {
		identityValue = strings.TrimSpace(request.IdempotencyKey)
	}
	if strings.TrimSpace(request.SessionKey) == "" || strings.TrimSpace(request.ToolName) == "" ||
		identityValue == "" || request.Timeout <= 0 {
		return openClawManagedApproval{}, false, errOpenClawManagedApprovalInvalid
	}
	requestIdentity := request.SessionKey + "\x00" + request.ToolName + "\x00" + identityValue

	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now().UTC()
	s.refreshLocked(now)
	if idValue, ok := s.byRequestID[requestIdentity]; ok {
		if record, exists := s.byID[idValue]; exists {
			return cloneOpenClawManagedApproval(record), false, nil
		}
	}

	generated, err := (&id.UUID{}).Generate()
	if err != nil {
		return openClawManagedApproval{}, false, err
	}
	record := openClawManagedApproval{
		ID: "cloudhub:" + generated, SessionKey: request.SessionKey, ToolName: request.ToolName,
		ToolCallID: request.ToolCallID, IdempotencyKey: request.IdempotencyKey,
		Title: request.Title, Description: request.Description, Severity: request.Severity,
		AllowedDecisions: []openclaw.PluginApprovalDecision{openclaw.DecisionAllowOnce, openclaw.DecisionDeny},
		State:            openClawManagedApprovalPending, CreatedAtMs: now.UnixMilli(),
		ExpiresAtMs: now.Add(request.Timeout).UnixMilli(), requestIdentity: requestIdentity,
	}
	s.byID[record.ID] = record
	s.byRequestID[requestIdentity] = record.ID
	return cloneOpenClawManagedApproval(record), true, nil
}

func (s *openClawManagedApprovalStore) Get(idValue string) (openClawManagedApproval, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.refreshLocked(s.now().UTC())
	record, ok := s.byID[idValue]
	if !ok {
		return openClawManagedApproval{}, errOpenClawManagedApprovalNotFound
	}
	return cloneOpenClawManagedApproval(record), nil
}

func (s *openClawManagedApprovalStore) ListPending(sessionKey string) []openClawManagedApproval {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.refreshLocked(s.now().UTC())
	records := make([]openClawManagedApproval, 0)
	for _, record := range s.byID {
		if record.SessionKey == sessionKey && record.State == openClawManagedApprovalPending {
			records = append(records, cloneOpenClawManagedApproval(record))
		}
	}
	sort.Slice(records, func(i, j int) bool { return records[i].CreatedAtMs > records[j].CreatedAtMs })
	return records
}

func (s *openClawManagedApprovalStore) Resolve(
	idValue string,
	sessionKey string,
	decision openclaw.PluginApprovalDecision,
) (openClawManagedApproval, error) {
	if decision != openclaw.DecisionAllowOnce && decision != openclaw.DecisionDeny {
		return openClawManagedApproval{}, errOpenClawManagedApprovalInvalid
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now().UTC()
	s.refreshLocked(now)
	record, ok := s.byID[idValue]
	if !ok {
		return openClawManagedApproval{}, errOpenClawManagedApprovalNotFound
	}
	if record.SessionKey != sessionKey || record.State != openClawManagedApprovalPending {
		return openClawManagedApproval{}, errOpenClawManagedApprovalConflict
	}
	if decision == openclaw.DecisionAllowOnce {
		record.State = openClawManagedApprovalAllowed
	} else {
		record.State = openClawManagedApprovalDenied
	}
	record.Decision = decision
	record.ResolvedAtMs = now.UnixMilli()
	s.byID[idValue] = record
	return cloneOpenClawManagedApproval(record), nil
}

func (s *openClawManagedApprovalStore) refreshLocked(now time.Time) {
	nowMs := now.UnixMilli()
	for idValue, record := range s.byID {
		if record.State == openClawManagedApprovalPending && nowMs >= record.ExpiresAtMs {
			record.State = openClawManagedApprovalExpired
			record.ResolvedAtMs = record.ExpiresAtMs
			s.byID[idValue] = record
		}
		terminalAt := record.ResolvedAtMs
		if terminalAt > 0 && nowMs > terminalAt+openClawManagedApprovalRetention.Milliseconds() {
			delete(s.byID, idValue)
			if s.byRequestID[record.requestIdentity] == idValue {
				delete(s.byRequestID, record.requestIdentity)
			}
		}
	}
}

func cloneOpenClawManagedApproval(record openClawManagedApproval) openClawManagedApproval {
	record.AllowedDecisions = append([]openclaw.PluginApprovalDecision(nil), record.AllowedDecisions...)
	return record
}
