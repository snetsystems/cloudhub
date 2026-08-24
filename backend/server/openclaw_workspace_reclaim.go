package server

import (
	"net/http"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// openClawPendingReclaimResponse is one leftover the sweep could not clear.
type openClawPendingReclaimResponse struct {
	OrganizationID string    `json:"organizationId"`
	Purpose        string    `json:"purpose"`
	AgentID        string    `json:"agentId"`
	DeletedAt      time.Time `json:"deletedAt"`
	Error          string    `json:"error,omitempty"`
}

// openClawWorkspaceReclaimResponse reports what one sweep did and what it left.
type openClawWorkspaceReclaimResponse struct {
	Reclaimed int                              `json:"reclaimed"`
	Failed    int                              `json:"failed"`
	Pending   []openClawPendingReclaimResponse `json:"pending"`
}

// OpenClawWorkspaceReclaim clears Gateway workspaces that outlived the
// organizations that owned them.
//
// Deleting an organization reclaims its workspaces inline, but that runs
// against a Gateway that may be down, and the organization is deleted either
// way. The mappings it could not clear stay recorded as pending, and this is
// what retries them.
//
// Deleting a workspace is idempotent, so a sweep that runs against leftovers
// that are in fact already gone simply marks them and reports them reclaimed.
//
// The response doubles as the outstanding list: a sweep with nothing to do
// answers with an empty pending list, which is how an operator checks whether
// anything is owed without a second endpoint.
func (s *Service) OpenClawWorkspaceReclaim(w http.ResponseWriter, r *http.Request) {
	// Leftovers span organizations, so this reads the unscoped store. The
	// route is SuperAdmin-only for that reason.
	ctx := serverContext(r.Context())

	// Without a way to delete files a sweep would mark leftovers reclaimed
	// while they sit on the host, which is worse than refusing.
	if s.OpenClawSkillDeleter == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw skill-admin is not configured", s.Logger)
		return
	}
	store := s.Store.OpenClawOrgAgents(ctx)
	if store == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw agent mappings are not configured", s.Logger)
		return
	}

	pending, err := store.PendingReclaim(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	response := openClawWorkspaceReclaimResponse{Pending: []openClawPendingReclaimResponse{}}
	for _, entry := range pending {
		if err := s.reclaimOpenClawAgent(ctx, entry.AgentID); err != nil {
			response.Failed++
			response.Pending = append(response.Pending, pendingReclaimResponse(entry, err.Error()))
			continue
		}
		// A mapping whose files are gone but which cannot be marked is still
		// pending as far as the store is concerned, so it is reported that way
		// rather than counted as done.
		if err := store.MarkReclaimed(ctx, entry.OrganizationID, entry.Purpose); err != nil {
			response.Failed++
			response.Pending = append(response.Pending, pendingReclaimResponse(entry, err.Error()))
			continue
		}
		response.Reclaimed++
	}

	encodeJSON(w, http.StatusOK, response, s.Logger)
}

func pendingReclaimResponse(entry cloudhub.OpenClawPendingReclaim, reason string) openClawPendingReclaimResponse {
	return openClawPendingReclaimResponse{
		OrganizationID: entry.OrganizationID,
		Purpose:        entry.Purpose,
		AgentID:        entry.AgentID,
		DeletedAt:      entry.DeletedAt,
		Error:          reason,
	}
}
