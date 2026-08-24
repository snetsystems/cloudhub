package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
	"github.com/snetsystems/cloudhub/backend/organizations"
	"github.com/snetsystems/cloudhub/backend/roles"
)

type organizationRequest struct {
	Name        string `json:"name"`
	DefaultRole string `json:"defaultRole"`
}

func (r *organizationRequest) ValidCreate() error {
	if r.Name == "" {
		return fmt.Errorf("Name required on CloudHub Organization request body")
	}

	return r.ValidDefaultRole()
}

func (r *organizationRequest) ValidUpdate() error {
	if r.Name == "" && r.DefaultRole == "" {
		return fmt.Errorf("No fields to update")
	}

	if r.DefaultRole != "" {
		return r.ValidDefaultRole()
	}

	return nil
}

func (r *organizationRequest) ValidDefaultRole() error {
	if r.DefaultRole == "" {
		r.DefaultRole = roles.MemberRoleName
	}

	switch r.DefaultRole {
	case roles.MemberRoleName, roles.ViewerRoleName, roles.EditorRoleName, roles.AdminRoleName:
		return nil
	default:
		return fmt.Errorf("default role must be member, viewer, editor, or admin")
	}
}

type organizationResponse struct {
	Links selfLinks `json:"links"`
	cloudhub.Organization
}

func newOrganizationResponse(o *cloudhub.Organization) *organizationResponse {
	if o == nil {
		o = &cloudhub.Organization{}
	}
	return &organizationResponse{
		Organization: *o,
		Links: selfLinks{
			Self: fmt.Sprintf("/cloudhub/v1/organizations/%s", o.ID),
		},
	}
}

type organizationsResponse struct {
	Links         selfLinks               `json:"links"`
	Organizations []*organizationResponse `json:"organizations"`
}

func newOrganizationsResponse(orgs []cloudhub.Organization) *organizationsResponse {
	orgsResp := make([]*organizationResponse, len(orgs))
	for i, org := range orgs {
		orgsResp[i] = newOrganizationResponse(&org)
	}
	return &organizationsResponse{
		Organizations: orgsResp,
		Links: selfLinks{
			Self: "/cloudhub/v1/organizations",
		},
	}
}

// Organizations retrieves all organizations from store
func (s *Service) Organizations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	orgs, err := s.Store.Organizations(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	res := newOrganizationsResponse(orgs)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewOrganization adds a new organization to store
func (s *Service) NewOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	org := &cloudhub.Organization{
		Name:        req.Name,
		DefaultRole: req.DefaultRole,
	}

	res, err := s.Store.Organizations(ctx).Add(ctx, org)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	// Now that the organization was created, add the user
	// making the request to the organization
	user, ok := hasUserContext(ctx)
	if !ok {
		// Best attempt at cleanup the organization if there were any errors
		_ = s.Store.Organizations(ctx).Delete(ctx, res)
		Error(w, http.StatusInternalServerError, "failed to retrieve user from context", s.Logger)
		return
	}

	user.Roles = []cloudhub.Role{
		{
			Organization: res.ID,
			Name:         roles.AdminRoleName,
		},
	}

	orgCtx := context.WithValue(ctx, organizations.ContextKey, res.ID)
	_, err = s.Store.Users(orgCtx).Add(orgCtx, user)
	if err != nil {
		// Best attempt at cleanup the organization if there were any errors adding user to org
		_ = s.Store.Organizations(ctx).Delete(ctx, res)
		s.Logger.Error("failed to add user to organization", err.Error())
		Error(w, http.StatusInternalServerError, "failed to add user to organization", s.Logger)
		return
	}

	if err := s.syncDefaultRecipientGroupsForOrgIDs(ctx, []string{res.ID}); err != nil {
		_ = s.Store.Organizations(ctx).Delete(ctx, res)
		s.Logger.Error("failed to initialize default recipient group", err.Error())
		Error(w, http.StatusInternalServerError, "failed to initialize default recipient group", s.Logger)
		return
	}

	// Initialize builtin dashboards for the new organization
	builtinStore := &builtin.BinDashboardsStore{
		Logger: s.Logger,
	}
	// Use server context to get direct access to dashboards store
	serverCtx := serverContext(ctx)
	dashboardsStore := s.Store.Dashboards(serverCtx)
	mappingStore := s.Store.FixedCellMappingStore()
	if err := InitializeFixedCells(orgCtx, res.ID, dashboardsStore, builtinStore, mappingStore, s.Logger); err != nil {
		// Log error but don't fail organization creation
		s.Logger.
			WithField("component", "fixed-cell").
			WithField("organization", res.ID).
			Error("Failed to initialize fixed-cells for new organization:", err)
	}

	// log registrationte
	msg := fmt.Sprintf(MsgOrganizationCreated.String(), res.Name)
	s.logRegistration(ctx, "Organizations", msg)

	co := newOrganizationResponse(res)
	location(w, co.Links.Self)
	encodeJSON(w, http.StatusCreated, co, s.Logger)
}

// OrganizationID retrieves a organization with ID from store
func (s *Service) OrganizationID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	id := httprouter.GetParamFromContext(ctx, "oid")

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	res := newOrganizationResponse(org)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// UpdateOrganization updates an organization in the organizations store
func (s *Service) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	id := httprouter.GetParamFromContext(ctx, "oid")

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	if req.Name != "" {
		org.Name = req.Name
	}

	if req.DefaultRole != "" {
		org.DefaultRole = req.DefaultRole
	}

	err = s.Store.Organizations(ctx).Update(ctx, org)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgOrganizationModified.String(), org.Name)
	s.logRegistration(ctx, "Organizations", msg)

	res := newOrganizationResponse(org)
	location(w, res.Links.Self)
	encodeJSON(w, http.StatusOK, res, s.Logger)

}

// RemoveOrganization removes an organization in the organizations store
func (s *Service) RemoveOrganization(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := httprouter.GetParamFromContext(ctx, "oid")

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusNotFound, err.Error(), s.Logger)
		return
	}
	devices, err := s.Store.NetworkDevice(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	for _, device := range devices {
		if device.Organization == org.ID {
			msg := "The organization cannot be deleted because there are registered devices associated with it."
			Error(w, http.StatusConflict, msg, s.Logger)
			return
		}
	}

	if err := s.cleanupOrganizationAlertResources(ctx, org.ID); err != nil {
		s.Logger.Error("failed to clean up organization alert resources", err.Error())
		Error(w, http.StatusInternalServerError, organizationAlertCleanupMessage(err), s.Logger)
		return
	}

	// Move device mappings from the organization being deleted to default organization
	deviceMappings, err := s.Store.DeviceMappings(ctx).AllDevices(ctx, cloudhub.AccessContext{
		IsSuperAdmin: hasSuperAdminContext(ctx),
		OrgID:        org.ID,
	})
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	// Update device mappings to move them to default organization
	for _, device := range deviceMappings {
		if device.OrgID == org.ID {
			updatedDevice := &cloudhub.DeviceMeta{
				IP:          device.IP,
				Hostname:    device.Hostname,
				AliasName:   device.AliasName,
				DeviceType:  device.DeviceType,
				OrgID:       cloudhub.DefaultOrgID,
				IsDeletable: device.IsDeletable,
				AppName:     device.AppName,
			}
			if err := s.Store.DeviceMappings(ctx).UpdateDevice(ctx, device.Hostname, updatedDevice); err != nil {
				Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
				return
			}
		}
	}

	if err := s.Store.Organizations(ctx).Delete(ctx, org); err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	s.reclaimOpenClawWorkspaces(ctx, org.ID)

	// log registrationte
	msg := fmt.Sprintf(MsgOrganizationDeleted.String(), org.Name)
	s.logRegistration(ctx, "Organizations", msg)

	w.WriteHeader(http.StatusNoContent)
}

// OrganizationExists checks if an organization with the given organization ID exists in the store.
func (s *Service) OrganizationExists(ctx context.Context, orgID string) error {
	if _, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &orgID}); err != nil {
		return fmt.Errorf("organization does not exist")
	}
	return nil
}

// OrganizationNameByID retrieves the name of the organization given its ID.
func (s *Service) OrganizationNameByID(ctx context.Context, orgID string) (string, error) {
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &orgID})
	if err != nil {
		return "", fmt.Errorf("organization does not exist")
	}
	return org.Name, nil
}

type organizationAlertCleanupError struct {
	message string
	err     error
}

func (e organizationAlertCleanupError) Error() string {
	return e.err.Error()
}

func (e organizationAlertCleanupError) Unwrap() error {
	return e.err
}

func newOrganizationAlertCleanupError(message string, err error) error {
	return organizationAlertCleanupError{message: message, err: err}
}

func organizationAlertCleanupMessage(err error) string {
	if e, ok := err.(organizationAlertCleanupError); ok {
		return e.message
	}
	return "failed to clean up alert resources before deleting organization"
}

func (s *Service) cleanupOrganizationAlertResources(ctx context.Context, orgID string) error {
	if s.AlertGroupRules != nil {
		rules, err := s.AlertGroupRules.All(ctx, orgID)
		if err != nil {
			return newOrganizationAlertCleanupError(
				"failed to clean up alert resources before deleting organization",
				fmt.Errorf("list alert rules for org %s: %w", orgID, err),
			)
		}
		for _, rule := range rules {
			if rule.KapacitorID != "" {
				if s.AlertKapacitors == nil {
					return newOrganizationAlertCleanupError(
						"failed to delete alert task before deleting organization",
						fmt.Errorf("alert kapacitor store unavailable for rule %s", rule.ID),
					)
				}
				kapa, err := s.AlertKapacitors.Get(ctx, rule.KapacitorID)
				if err != nil {
					return newOrganizationAlertCleanupError(
						"failed to delete alert task before deleting organization",
						fmt.Errorf("get alert kapacitor %s for rule %s: %w", rule.KapacitorID, rule.ID, err),
					)
				}
				taskID := "alert-group-" + rule.ID
				if err := deleteKapacitorTask(kapa.URL, taskID); err != nil {
					return newOrganizationAlertCleanupError(
						"failed to delete alert task before deleting organization",
						fmt.Errorf("delete kapacitor task %s for rule %s: %w", taskID, rule.ID, err),
					)
				}
			}
			if err := s.AlertGroupRules.Delete(ctx, rule.ID); err != nil {
				return newOrganizationAlertCleanupError(
					"failed to clean up alert resources before deleting organization",
					fmt.Errorf("delete alert rule %s: %w", rule.ID, err),
				)
			}
		}
	}

	if s.AlertKapacitors != nil {
		kapacitors, err := s.AlertKapacitors.All(ctx, orgID)
		if err != nil {
			return newOrganizationAlertCleanupError(
				"failed to clean up alert resources before deleting organization",
				fmt.Errorf("list alert kapacitors for org %s: %w", orgID, err),
			)
		}
		for _, kapa := range kapacitors {
			if err := s.AlertKapacitors.Delete(ctx, kapa.ID); err != nil {
				return newOrganizationAlertCleanupError(
					"failed to clean up alert resources before deleting organization",
					fmt.Errorf("delete alert kapacitor %s: %w", kapa.ID, err),
				)
			}
		}
	}

	if s.RecipientGroups != nil {
		groups, err := s.RecipientGroups.All(ctx, orgID)
		if err != nil {
			return newOrganizationAlertCleanupError(
				"failed to clean up alert resources before deleting organization",
				fmt.Errorf("list recipient groups for org %s: %w", orgID, err),
			)
		}
		for _, group := range groups {
			if err := s.RecipientGroups.Delete(ctx, group.ID); err != nil {
				return newOrganizationAlertCleanupError(
					"failed to clean up alert resources before deleting organization",
					fmt.Errorf("delete recipient group %s: %w", group.ID, err),
				)
			}
		}
	}

	return nil
}

// reclaimOpenClawWorkspaces removes a deleted organization's Gateway agents and
// the workspaces they used, then retires the mappings.
//
// The mappings are soft-deleted rather than dropped: every skill revision
// stays in CloudHub, so restoring a mapping is enough to rebuild the workspace
// and republish. Reclaiming the files therefore costs nothing recoverable.
//
// Failures are logged, not returned. The organization is already deleted, and
// making that outcome depend on the Gateway being reachable would mean an
// operator cannot remove an organization while OpenClaw is down. What fails
// here stays unmarked and is picked up later by the reclaim sweep.
func (s *Service) reclaimOpenClawWorkspaces(ctx context.Context, orgID string) {
	// Nothing to reclaim on a deployment that does not run OpenClaw.
	if s.OpenClawAgentProvisioner == nil && s.OpenClawSkillDeleter == nil {
		return
	}
	store := s.Store.OpenClawOrgAgents(ctx)
	if store == nil {
		return
	}
	agents, err := store.All(ctx, orgID)
	if err != nil {
		s.Logger.Error("failed to read OpenClaw agent mappings for a deleted organization: ", err.Error())
		return
	}
	if len(agents) == 0 {
		return
	}

	reclaimed := make([]string, 0, len(agents))
	for purpose, agentID := range agents {
		if err := s.reclaimOpenClawAgent(ctx, agentID); err != nil {
			s.Logger.Error("failed to reclaim OpenClaw agent ", agentID, " (", purpose, "): ", err.Error())
			continue
		}
		reclaimed = append(reclaimed, purpose)
	}

	// Retire every mapping, whether or not its workspace went away: the
	// organization is gone, so none of them may resolve any more.
	if err := store.SoftDelete(ctx, orgID); err != nil {
		s.Logger.Error("failed to retire OpenClaw agent mappings: ", err.Error())
		return
	}
	// Only what actually went away is marked. The rest stays pending so a
	// sweep can find the files still on the host.
	for _, purpose := range reclaimed {
		if err := store.MarkReclaimed(ctx, orgID, purpose); err != nil {
			s.Logger.Error("failed to record a reclaimed OpenClaw workspace (", purpose, "): ", err.Error())
		}
	}
}

// reclaimOpenClawAgent removes one agent from the Gateway and deletes the
// workspace it left behind.
//
// Both steps run even if the first fails: the Gateway forgetting an agent and
// the files going away are independent, and a partial success still reduces
// what a later sweep has to do. The agent record is removed first so nothing
// can be scheduled onto a workspace that is about to disappear.
func (s *Service) reclaimOpenClawAgent(ctx context.Context, agentID string) error {
	var failures []error
	if s.OpenClawAgentProvisioner != nil {
		if err := s.OpenClawAgentProvisioner.Remove(ctx, agentID); err != nil {
			failures = append(failures, fmt.Errorf("remove agent: %w", err))
		}
	}
	if s.OpenClawSkillDeleter != nil {
		if err := s.OpenClawSkillDeleter.DeleteWorkspace(ctx, agentID); err != nil {
			failures = append(failures, fmt.Errorf("delete workspace: %w", err))
		}
	}
	return errors.Join(failures...)
}
