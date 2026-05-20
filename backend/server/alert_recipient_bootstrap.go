package server

import (
	"context"
	"strconv"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

const defaultRecipientGroupNameSuffix = "Default Recipients"

func orgIDsFromRoles(roles []cloudhub.Role) []string {
	seen := make(map[string]struct{}, len(roles))
	out := make([]string, 0, len(roles))
	for _, r := range roles {
		if r.Organization == "" {
			continue
		}
		if _, ok := seen[r.Organization]; ok {
			continue
		}
		seen[r.Organization] = struct{}{}
		out = append(out, r.Organization)
	}
	return out
}

// syncDefaultRecipientGroupsForOrgIDs ensures the default recipient group for
// each org mirrors that org's CloudHub user list. No-op when PG is unavailable.
func (s *Service) syncDefaultRecipientGroupsForOrgIDs(ctx context.Context, orgIDs []string) error {
	if s.RecipientGroups == nil {
		return nil
	}
	serverCtx := serverContext(ctx)
	seen := make(map[string]struct{}, len(orgIDs))
	for _, orgID := range orgIDs {
		if orgID == "" {
			continue
		}
		if _, ok := seen[orgID]; ok {
			continue
		}
		seen[orgID] = struct{}{}
		if err := ensureDefaultRecipientGroupForOrg(serverCtx, s, orgID, s.Logger); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) syncDefaultRecipientGroupsForUser(ctx context.Context, user *cloudhub.User) error {
	if user == nil {
		return nil
	}
	return s.syncDefaultRecipientGroupsForOrgIDs(ctx, orgIDsFromRoles(user.Roles))
}

func defaultAlertRecipientMemberPrefs(memberID string, hasEmail bool) cloudhub.AlertRecipientMemberPrefs {
	return cloudhub.AlertRecipientMemberPrefs{
		RecipientGroupMemberID: memberID,
		EmailEnabled:           hasEmail,
		EmailLevel:             "all",
	}
}

func defaultRecipientGroupName(ctx context.Context, service *Service, orgID string) string {
	name := strings.TrimSpace(orgID)
	if service != nil && service.Store != nil {
		if org, err := service.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &orgID}); err == nil && org != nil {
			if orgName := strings.TrimSpace(org.Name); orgName != "" {
				name = orgName
			}
		}
	}
	if name == "" {
		return defaultRecipientGroupNameSuffix
	}
	return name + " " + defaultRecipientGroupNameSuffix
}

type defaultGroupMemberSyncResult struct {
	Added, Updated, Removed int
}

// initializeAllOrgsDefaultRecipientGroups ensures each organization has a
// default alert recipient group whose members mirror the org user list.
// Called during server startup when PostgreSQL alert stores are configured.
func initializeAllOrgsDefaultRecipientGroups(ctx context.Context, service *Service, logger cloudhub.Logger) error {
	if service.RecipientGroups == nil {
		return nil
	}

	serverCtx := serverContext(ctx)
	orgs, err := service.Store.Organizations(serverCtx).All(serverCtx)
	if err != nil {
		logger.
			WithField("component", "alert-recipient-bootstrap").
			Error("Failed to list organizations:", err)
		return err
	}

	for _, org := range orgs {
		if err := ensureDefaultRecipientGroupForOrg(serverCtx, service, org.ID, logger); err != nil {
			logger.
				WithField("component", "alert-recipient-bootstrap").
				WithField("organization", org.ID).
				Error("Failed to bootstrap default recipient group:", err)
		}
	}
	return nil
}

func ensureDefaultRecipientGroupForOrg(ctx context.Context, service *Service, orgID string, logger cloudhub.Logger) error {
	groups, err := service.RecipientGroups.All(ctx, orgID)
	if err != nil {
		return err
	}

	var defaultGroup *cloudhub.RecipientGroup
	for i := range groups {
		if groups[i].IsDefault {
			defaultGroup = &groups[i]
			break
		}
	}

	if defaultGroup == nil {
		g, err := service.RecipientGroups.Add(ctx, cloudhub.RecipientGroup{
			OrgID:     orgID,
			Name:      defaultRecipientGroupName(ctx, service, orgID),
			IsDefault: true,
		})
		if err != nil {
			return err
		}
		defaultGroup = &g
		if err := ensureAlertRecipientGroupExtension(ctx, service, defaultGroup.ID); err != nil {
			return err
		}
		logger.
			WithField("component", "alert-recipient-bootstrap").
			WithField("organization", orgID).
			WithField("recipientGroupId", defaultGroup.ID).
			Info("Created default recipient group")
	} else if err := ensureAlertRecipientGroupExtension(ctx, service, defaultGroup.ID); err != nil {
		return err
	}

	syncResult, err := syncDefaultRecipientGroupMembers(ctx, service, orgID, *defaultGroup)
	if err != nil {
		return err
	}
	if syncResult.Added > 0 || syncResult.Updated > 0 || syncResult.Removed > 0 {
		if err := service.RegenerateRulesByRecipientGroup(ctx, orgID, *defaultGroup); err != nil {
			return err
		}
	}
	if syncResult.Added > 0 || syncResult.Updated > 0 || syncResult.Removed > 0 {
		logger.
			WithField("component", "alert-recipient-bootstrap").
			WithField("organization", orgID).
			WithField("recipientGroupId", defaultGroup.ID).
			WithField("membersAdded", syncResult.Added).
			WithField("membersUpdated", syncResult.Updated).
			WithField("membersRemoved", syncResult.Removed).
			Info("Synced org users into default recipient group")
	}
	return nil
}

func ensureAlertRecipientGroupExtension(ctx context.Context, service *Service, groupID string) error {
	if service.AlertRecipientGroups == nil {
		return nil
	}
	if _, err := service.AlertRecipientGroups.Get(ctx, groupID); err == nil {
		return nil
	}
	return service.AlertRecipientGroups.Upsert(ctx, cloudhub.AlertRecipientGroup{
		RecipientGroupID: groupID,
	})
}

func syncDefaultRecipientGroupMembers(ctx context.Context, service *Service, orgID string, group cloudhub.RecipientGroup) (defaultGroupMemberSyncResult, error) {
	var result defaultGroupMemberSyncResult

	orgCtx := context.WithValue(ctx, organizations.ContextKey, orgID)
	users, err := service.Store.Users(orgCtx).All(orgCtx)
	if err != nil {
		return result, err
	}

	orgUsersByID := make(map[string]cloudhub.User, len(users))
	for _, u := range users {
		orgUsersByID[strconv.FormatUint(u.ID, 10)] = u
	}

	existingByUserID := make(map[string]cloudhub.RecipientGroupMember, len(group.Members))
	for _, m := range group.Members {
		if m.UserID != "" {
			existingByUserID[m.UserID] = m
		}
	}

	for userID, m := range existingByUserID {
		if _, inOrg := orgUsersByID[userID]; inOrg {
			continue
		}
		if err := service.RecipientGroups.DeleteMember(ctx, m.ID); err != nil {
			return result, err
		}
		result.Removed++
		delete(existingByUserID, userID)
	}

	for userID, u := range orgUsersByID {
		email := strings.TrimSpace(u.Email)
		hasEmail := email != ""

		if m, ok := existingByUserID[userID]; ok {
			if m.UserName != u.Name || strings.TrimSpace(m.Email) != email {
				m.UserName = u.Name
				m.Email = email
				if err := service.RecipientGroups.UpdateMember(ctx, m); err != nil {
					return result, err
				}
				result.Updated++
			}
			continue
		}

		member, err := service.RecipientGroups.AddMember(ctx, cloudhub.RecipientGroupMember{
			RecipientGroupID: group.ID,
			UserID:           userID,
			UserName:         u.Name,
			Email:            email,
		})
		if err != nil {
			return result, err
		}
		result.Added++

		if service.AlertRecipientMemberPrefs != nil {
			if err := ensureDefaultMemberPrefs(ctx, service, member.ID, hasEmail); err != nil {
				return result, err
			}
		}
	}
	return result, nil
}

func ensureDefaultMemberPrefs(ctx context.Context, service *Service, memberID string, hasEmail bool) error {
	if _, err := service.AlertRecipientMemberPrefs.Get(ctx, memberID); err == nil {
		return nil
	}
	return service.AlertRecipientMemberPrefs.Upsert(ctx, defaultAlertRecipientMemberPrefs(memberID, hasEmail))
}
