package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/snetsystems/cloudhub/backend/openclaw"
	"github.com/snetsystems/cloudhub/backend/roles"
)

type openClawRPCRequest struct {
	Method    string          `json:"method"`
	SessionID string          `json:"sessionId"`
	Params    json.RawMessage `json:"params"`
}

type openClawRPCPolicy struct {
	member        bool
	sessionScoped bool
}

var openClawRPCPolicies = map[string]openClawRPCPolicy{
	"agents.list":  {},
	"chat.history": {sessionScoped: true},
	"chat.send":    {member: true, sessionScoped: true},
}

type openClawRPCHistoryParams struct {
	Limit    *int `json:"limit"`
	Offset   *int `json:"offset"`
	MaxChars *int `json:"maxChars"`
}

type openClawRPCSendParams struct {
	Message        string `json:"message"`
	TimeoutMs      int    `json:"timeoutMs"`
	IdempotencyKey string `json:"idempotencyKey"`
}

// OpenClawRPC relays only the explicitly allowlisted Gateway methods. Session
// mapping fields are always reconstructed from CloudHub-owned session data.
func (s *Service) OpenClawRPC(w http.ResponseWriter, r *http.Request) {
	var request openClawRPCRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}

	policy, allowed := openClawRPCPolicies[request.Method]
	if !allowed {
		Error(w, http.StatusUnprocessableEntity, "unsupported OpenClaw RPC method", s.Logger)
		return
	}
	if policy.member && !openClawMemberContext(r.Context()) {
		Error(w, http.StatusForbidden, "User is not authorized", s.Logger)
		return
	}
	if s.OpenClawGateway == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}

	var sessionKey, agentID, sessionID string
	if policy.sessionScoped {
		ctx, _, _, ok := s.openClawOwnerContext(r)
		if !ok {
			Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
			return
		}
		session, ok := s.openClawOwnedSession(w, withOpenClawParam(r, request.SessionID), ctx)
		if !ok {
			return
		}
		sessionKey = session.SessionKey
		agentID = session.AgentID
		sessionID = session.ID
	}

	var (
		gatewayParams interface{}
		callCtx       = r.Context()
		cancel        context.CancelFunc
	)
	switch request.Method {
	case "agents.list":
		if err := decodeOpenClawRPCParams(request.Params, &struct{}{}); err != nil {
			Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
			return
		}
		gatewayParams = struct{}{}
	case "chat.history":
		params, err := openClawRPCHistoryRequest(request.Params)
		if err != nil {
			Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
			return
		}
		gatewayParams = openclaw.HistoryParams{
			SessionKey: sessionKey,
			AgentID:    agentID,
			Limit:      params.Limit,
			Offset:     params.Offset,
			MaxChars:   params.MaxChars,
		}
	case "chat.send":
		params, err := openClawRPCSendRequest(request.Params)
		if err != nil {
			Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
			return
		}
		callCtx, cancel = context.WithTimeout(r.Context(), time.Duration(params.TimeoutMs)*time.Millisecond)
		defer cancel()
		gatewayParams = openclaw.SendMessageParams{
			SessionKey:     sessionKey,
			AgentID:        agentID,
			Message:        params.Message,
			TimeoutMs:      params.TimeoutMs,
			IdempotencyKey: params.IdempotencyKey,
		}
	}

	payload, err := s.OpenClawGateway.Call(callCtx, request.Method, gatewayParams)
	if err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	if len(payload) == 0 {
		s.openClawGatewayError(w, fmt.Errorf("%w: %s response missing payload", openclaw.ErrProtocol, request.Method))
		return
	}
	if request.Method == "chat.send" {
		ctx, _, _, _ := s.openClawOwnerContext(r)
		if err := s.Store.OpenClawSessions(ctx).Touch(ctx, sessionID, time.Now().UTC()); err != nil {
			Error(w, http.StatusBadGateway, "unable to update session", s.Logger)
			return
		}
	}
	encodeJSON(w, http.StatusOK, payload, s.Logger)
}

func openClawMemberContext(ctx context.Context) bool {
	role, ok := hasRoleContext(ctx)
	if !ok {
		return false
	}
	switch role {
	case roles.MemberRoleName, roles.EditorRoleName, roles.AdminRoleName:
		return true
	default:
		return false
	}
}

func openClawRPCHistoryRequest(raw json.RawMessage) (openclaw.HistoryParams, error) {
	var request openClawRPCHistoryParams
	if err := decodeOpenClawRPCParams(raw, &request); err != nil {
		return openclaw.HistoryParams{}, err
	}
	params := openclaw.HistoryParams{
		Limit:    defaultOpenClawHistoryLimit,
		Offset:   0,
		MaxChars: defaultOpenClawHistoryMaxChars,
	}
	if request.Limit != nil {
		params.Limit = *request.Limit
	}
	if request.Offset != nil {
		params.Offset = *request.Offset
	}
	if request.MaxChars != nil {
		params.MaxChars = *request.MaxChars
	}
	if params.Limit < 1 || params.Limit > maxOpenClawHistoryLimit {
		return openclaw.HistoryParams{}, fmt.Errorf("limit is outside the allowed range")
	}
	if params.Offset < 0 {
		return openclaw.HistoryParams{}, fmt.Errorf("offset is outside the allowed range")
	}
	if params.MaxChars < 1 || params.MaxChars > maxOpenClawHistoryMaxChars {
		return openclaw.HistoryParams{}, fmt.Errorf("maxChars is outside the allowed range")
	}
	return params, nil
}

func openClawRPCSendRequest(raw json.RawMessage) (openclaw.SendMessageParams, error) {
	var request openClawRPCSendParams
	if err := decodeOpenClawRPCParams(raw, &request); err != nil {
		return openclaw.SendMessageParams{}, err
	}
	request.Message = strings.TrimSpace(request.Message)
	if request.Message == "" {
		return openclaw.SendMessageParams{}, fmt.Errorf("message is required")
	}
	if request.TimeoutMs == 0 {
		request.TimeoutMs = defaultOpenClawTimeoutMs
	}
	if request.TimeoutMs < 1 || request.TimeoutMs > maxOpenClawTimeoutMs {
		return openclaw.SendMessageParams{}, fmt.Errorf("timeoutMs is outside the allowed range")
	}
	if strings.TrimSpace(request.IdempotencyKey) == "" {
		return openclaw.SendMessageParams{}, fmt.Errorf("idempotencyKey is required")
	}
	return openclaw.SendMessageParams{
		Message:        request.Message,
		TimeoutMs:      request.TimeoutMs,
		IdempotencyKey: request.IdempotencyKey,
	}, nil
}

func decodeOpenClawRPCParams(raw json.RawMessage, target interface{}) error {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	if len(raw) == 0 || raw[0] != '{' {
		return fmt.Errorf("params must be an object")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("params must contain one JSON value")
		}
		return err
	}
	return nil
}
