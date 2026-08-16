package server

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bouk/httprouter"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

type openClawApprovalSource string

const (
	openClawApprovalSourceManaged openClawApprovalSource = "managed"
	openClawApprovalSourceNative  openClawApprovalSource = "native"
)

type openClawApprovalDTO struct {
	ID               string                            `json:"id"`
	Source           openClawApprovalSource            `json:"source"`
	Title            string                            `json:"title"`
	Description      string                            `json:"description"`
	Severity         string                            `json:"severity"`
	ToolName         string                            `json:"toolName"`
	AllowedDecisions []openclaw.PluginApprovalDecision `json:"allowedDecisions"`
	CreatedAt        int64                             `json:"createdAt"`
	ExpiresAt        int64                             `json:"expiresAt"`
}

type openClawApprovalsResponse struct {
	Approvals       []openClawApprovalDTO    `json:"approvals"`
	CompleteSources []openClawApprovalSource `json:"completeSources"`
}

type openClawApprovalResolveRequest struct {
	Decision openclaw.PluginApprovalDecision `json:"decision"`
}

func (s *Service) OpenClawSessionApprovals(w http.ResponseWriter, r *http.Request) {
	ctx, _, _, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	session, ok := s.openClawOwnedSession(w, r, ctx)
	if !ok {
		return
	}
	response := openClawApprovalsResponse{
		Approvals:       make([]openClawApprovalDTO, 0),
		CompleteSources: make([]openClawApprovalSource, 0, 2),
	}
	if s.openClawManagedApprovals != nil {
		response.CompleteSources = append(response.CompleteSources, openClawApprovalSourceManaged)
		for _, approval := range s.openClawManagedApprovals.ListPending(session.SessionKey) {
			response.Approvals = append(response.Approvals, openClawManagedApprovalResponse(approval))
		}
	}
	if s.OpenClawGateway == nil {
		if len(response.CompleteSources) == 0 {
			Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
			return
		}
		encodeJSON(w, http.StatusOK, response, s.Logger)
		return
	}
	approvals, err := s.OpenClawGateway.ListPluginApprovals(r.Context())
	if err != nil {
		if len(response.CompleteSources) == 0 {
			s.openClawGatewayError(w, err)
			return
		}
		encodeJSON(w, http.StatusOK, response, s.Logger)
		return
	}
	response.CompleteSources = append(response.CompleteSources, openClawApprovalSourceNative)
	for _, approval := range approvals {
		if approval.SessionKey != session.SessionKey {
			continue
		}
		response.Approvals = append(response.Approvals, openClawApprovalResponse(approval))
	}
	sort.SliceStable(response.Approvals, func(i, j int) bool {
		return response.Approvals[i].CreatedAt > response.Approvals[j].CreatedAt
	})
	encodeJSON(w, http.StatusOK, response, s.Logger)
}

func (s *Service) OpenClawSessionApprovalResolve(w http.ResponseWriter, r *http.Request) {
	ctx, user, _, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	session, ok := s.openClawOwnedSession(w, r, ctx)
	if !ok {
		return
	}
	approvalID := httprouter.GetParamFromContext(r.Context(), "approvalId")
	if approvalID == "" {
		Error(w, http.StatusUnprocessableEntity, "approval ID is required", s.Logger)
		return
	}
	var request openClawApprovalResolveRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	if request.Decision != openclaw.DecisionAllowOnce && request.Decision != openclaw.DecisionDeny {
		Error(w, http.StatusUnprocessableEntity, "decision must be allow-once or deny", s.Logger)
		return
	}
	if strings.HasPrefix(approvalID, "cloudhub:") {
		if s.openClawManagedApprovals == nil {
			Error(w, http.StatusNotFound, "managed approval not found", s.Logger)
			return
		}
		resolved, err := s.openClawManagedApprovals.Resolve(approvalID, session.SessionKey, request.Decision)
		if errors.Is(err, errOpenClawManagedApprovalNotFound) {
			Error(w, http.StatusNotFound, "managed approval not found", s.Logger)
			return
		}
		if errors.Is(err, errOpenClawManagedApprovalConflict) {
			Error(w, http.StatusConflict, "approval is no longer pending for this session", s.Logger)
			return
		}
		if err != nil {
			Error(w, http.StatusInternalServerError, "unable to resolve managed approval", s.Logger)
			return
		}
		event := openClawManagedApprovalEvent(openclaw.EventApprovalResolved, resolved)
		event.ApprovalResolvedBy = strconv.FormatUint(user.ID, 10)
		s.publishOpenClawManagedApprovalEvent(event)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if s.OpenClawGateway == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}

	approvals, err := s.OpenClawGateway.ListPluginApprovals(r.Context())
	if err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	var pending *openclaw.PluginApproval
	for i := range approvals {
		if approvals[i].ID == approvalID && approvals[i].SessionKey == session.SessionKey {
			pending = &approvals[i]
			break
		}
	}
	if pending == nil || pending.ExpiresAtMs <= time.Now().UnixMilli() ||
		!approvalOffersDecision(*pending, request.Decision) {
		Error(w, http.StatusConflict, "approval is no longer pending for this session", s.Logger)
		return
	}

	if err := s.OpenClawGateway.ResolvePluginApproval(r.Context(), openclaw.ResolvePluginApprovalParams{
		ID: approvalID, Decision: request.Decision,
	}); err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func openClawManagedApprovalResponse(approval openClawManagedApproval) openClawApprovalDTO {
	return openClawApprovalDTO{
		ID: approval.ID, Source: openClawApprovalSourceManaged,
		Title: approval.Title, Description: approval.Description,
		Severity: approval.Severity, ToolName: approval.ToolName,
		AllowedDecisions: append([]openclaw.PluginApprovalDecision(nil), approval.AllowedDecisions...),
		CreatedAt:        approval.CreatedAtMs, ExpiresAt: approval.ExpiresAtMs,
	}
}

func openClawApprovalResponse(approval openclaw.PluginApproval) openClawApprovalDTO {
	return openClawApprovalDTO{
		ID:               approval.ID,
		Source:           openClawApprovalSourceNative,
		Title:            approval.Title,
		Description:      approval.Description,
		Severity:         approval.Severity,
		ToolName:         approval.ToolName,
		AllowedDecisions: append([]openclaw.PluginApprovalDecision(nil), approval.AllowedDecisions...),
		CreatedAt:        approval.CreatedAtMs,
		ExpiresAt:        approval.ExpiresAtMs,
	}
}

func approvalOffersDecision(approval openclaw.PluginApproval, decision openclaw.PluginApprovalDecision) bool {
	for _, allowed := range approval.AllowedDecisions {
		if allowed == decision {
			return true
		}
	}
	return false
}
