package server

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/bouk/httprouter"
	"github.com/google/uuid"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

const (
	openClawManagedApprovalTimeout    = 120 * time.Second
	openClawManagedApprovalMaxDisplay = 512
)

var openClawManagedApprovalTools = map[string]struct{}{
	"mcp__k8s_network__repair_network_policy_port": {},
	"k8s_network__repair_network_policy_port":      {},
}

type openClawManagedApprovalCreateRequest struct {
	SessionKey     string `json:"sessionKey"`
	ToolName       string `json:"toolName"`
	ToolCallID     string `json:"toolCallId"`
	IdempotencyKey string `json:"idempotencyKey"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Severity       string `json:"severity"`
	TimeoutMs      int64  `json:"timeoutMs"`
}

type openClawManagedApprovalStatusResponse struct {
	ID        string                       `json:"id"`
	State     openClawManagedApprovalState `json:"state"`
	CreatedAt int64                        `json:"createdAt"`
	ExpiresAt int64                        `json:"expiresAt"`
}

func openClawManagedApprovalServiceAuth(configuredToken string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if configuredToken == "" {
			http.Error(w, "service authentication is not configured", http.StatusServiceUnavailable)
			return
		}

		suppliedToken := r.Header.Get("X-CloudHub-Token")
		if suppliedToken == "" {
			authorization := r.Header.Get("Authorization")
			if strings.HasPrefix(authorization, "Bearer ") {
				suppliedToken = strings.TrimPrefix(authorization, "Bearer ")
			}
		}
		if suppliedToken == "" || subtle.ConstantTimeCompare([]byte(suppliedToken), []byte(configuredToken)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (s *Service) OpenClawManagedApprovalCreate(w http.ResponseWriter, r *http.Request) {
	if s.openClawManagedApprovals == nil {
		Error(w, http.StatusServiceUnavailable, "managed approval service is unavailable", s.Logger)
		return
	}

	var request openClawManagedApprovalCreateRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	if status, message := validateOpenClawManagedApprovalRequest(request); status != 0 {
		Error(w, status, message, s.Logger)
		return
	}
	if status, message := s.validateOpenClawManagedApprovalSession(r, request.SessionKey); status != 0 {
		Error(w, status, message, s.Logger)
		return
	}

	record, created, err := s.openClawManagedApprovals.Create(openClawManagedApprovalCreate{
		SessionKey:     request.SessionKey,
		ToolName:       request.ToolName,
		ToolCallID:     request.ToolCallID,
		IdempotencyKey: request.IdempotencyKey,
		Title:          request.Title,
		Description:    request.Description,
		Severity:       request.Severity,
		Timeout:        openClawManagedApprovalTimeout,
	})
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, "invalid managed approval request", s.Logger)
		return
	}
	if created {
		s.publishOpenClawManagedApprovalEvent(
			openClawManagedApprovalEvent(openclaw.EventApprovalRequested, record),
		)
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	encodeJSON(w, status, openClawManagedApprovalStatus(record), s.Logger)
}

func openClawManagedApprovalEvent(
	kind openclaw.EventKind,
	record openClawManagedApproval,
) openclaw.GatewayEvent {
	return openclaw.GatewayEvent{
		Kind:       kind,
		SessionKey: record.SessionKey,
		Approval: &openclaw.PluginApproval{
			ID: record.ID, Title: record.Title, Description: record.Description,
			Severity: record.Severity, ToolName: record.ToolName,
			AllowedDecisions: append([]openclaw.PluginApprovalDecision(nil), record.AllowedDecisions...),
			SessionKey:       record.SessionKey, CreatedAtMs: record.CreatedAtMs, ExpiresAtMs: record.ExpiresAtMs,
		},
		ApprovalDecision:     record.Decision,
		ApprovalResolvedAtMs: record.ResolvedAtMs,
	}
}

func (s *Service) publishOpenClawManagedApprovalEvent(event openclaw.GatewayEvent) {
	if s.OpenClawGateway != nil {
		s.openClawEventFanout().Publish(event)
	}
}

func (s *Service) OpenClawManagedApprovalStatus(w http.ResponseWriter, r *http.Request) {
	if s.openClawManagedApprovals == nil {
		Error(w, http.StatusServiceUnavailable, "managed approval service is unavailable", s.Logger)
		return
	}
	approvalID := httprouter.GetParamFromContext(r.Context(), "approvalId")
	if !strings.HasPrefix(approvalID, "cloudhub:") {
		Error(w, http.StatusNotFound, "managed approval not found", s.Logger)
		return
	}
	record, err := s.openClawManagedApprovals.Get(approvalID)
	if err != nil {
		if errors.Is(err, errOpenClawManagedApprovalNotFound) {
			Error(w, http.StatusNotFound, "managed approval not found", s.Logger)
			return
		}
		Error(w, http.StatusInternalServerError, "unable to load managed approval", s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, openClawManagedApprovalStatus(record), s.Logger)
}

func validateOpenClawManagedApprovalRequest(request openClawManagedApprovalCreateRequest) (int, string) {
	if strings.TrimSpace(request.SessionKey) == "" {
		return http.StatusUnprocessableEntity, "sessionKey is required"
	}
	if _, ok := openClawManagedApprovalTools[request.ToolName]; !ok {
		return http.StatusUnprocessableEntity, "toolName is not allowed"
	}
	if strings.TrimSpace(request.ToolCallID) == "" && strings.TrimSpace(request.IdempotencyKey) == "" {
		return http.StatusUnprocessableEntity, "toolCallId or idempotencyKey is required"
	}
	if strings.TrimSpace(request.Title) == "" {
		return http.StatusUnprocessableEntity, "title is required"
	}
	if len(request.Title) > openClawManagedApprovalMaxDisplay ||
		len(request.Description) > openClawManagedApprovalMaxDisplay ||
		len(request.Severity) > openClawManagedApprovalMaxDisplay {
		return http.StatusUnprocessableEntity, "approval display field exceeds maximum size"
	}
	if request.TimeoutMs != openClawManagedApprovalTimeout.Milliseconds() {
		return http.StatusUnprocessableEntity, "timeoutMs must be 120000"
	}
	return 0, ""
}

func (s *Service) validateOpenClawManagedApprovalSession(r *http.Request, sessionKey string) (int, string) {
	separator := strings.LastIndex(sessionKey, ":")
	if separator < 0 || separator == len(sessionKey)-1 {
		return http.StatusUnprocessableEntity, "sessionKey is invalid"
	}
	sessionID := sessionKey[separator+1:]
	if _, err := uuid.Parse(sessionID); err != nil {
		return http.StatusUnprocessableEntity, "sessionKey is invalid"
	}
	if s.Store == nil {
		return http.StatusServiceUnavailable, "session store is unavailable"
	}
	store := s.Store.OpenClawSessions(serverContext(r.Context()))
	if store == nil {
		return http.StatusServiceUnavailable, "session store is unavailable"
	}
	session, err := store.Get(serverContext(r.Context()), sessionID)
	if errors.Is(err, cloudhub.ErrOpenClawSessionNotFound) {
		return http.StatusUnprocessableEntity, "sessionKey is not trusted"
	}
	if err != nil {
		return http.StatusBadGateway, "unable to validate sessionKey"
	}
	if session == nil {
		return http.StatusUnprocessableEntity, "sessionKey is not trusted"
	}
	if session.SessionKey != sessionKey {
		return http.StatusUnprocessableEntity, "sessionKey is not trusted"
	}
	return 0, ""
}

func openClawManagedApprovalStatus(record openClawManagedApproval) openClawManagedApprovalStatusResponse {
	return openClawManagedApprovalStatusResponse{
		ID: record.ID, State: record.State, CreatedAt: record.CreatedAtMs, ExpiresAt: record.ExpiresAtMs,
	}
}
