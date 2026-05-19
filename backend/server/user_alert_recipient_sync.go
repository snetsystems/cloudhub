package server

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func (s *Service) syncAlertRecipientMembersForUserEmailChange(ctx context.Context, orgID string, user *cloudhub.User, oldEmail string) error {
	if user == nil || s.RecipientGroups == nil {
		return nil
	}

	newEmail := strings.TrimSpace(user.Email)
	if strings.TrimSpace(oldEmail) == newEmail {
		return nil
	}

	userID := strconv.FormatUint(user.ID, 10)
	members, err := s.RecipientGroups.MembersByUserID(ctx, orgID, userID)
	if err != nil {
		return fmt.Errorf("sync alert recipient members: list members: %w", err)
	}

	groupsToRegen := map[string]cloudhub.RecipientGroup{}
	for _, member := range members {
		emailChanged := strings.TrimSpace(member.Email) != newEmail
		if !emailChanged && member.UserName == user.Name {
			continue
		}

		member.Email = newEmail
		if user.Name != "" {
			member.UserName = user.Name
		}
		if err := s.RecipientGroups.UpdateMember(ctx, member); err != nil {
			return fmt.Errorf("sync alert recipient members: update member %s: %w", member.ID, err)
		}
		if !emailChanged {
			continue
		}

		group, err := s.RecipientGroups.Get(ctx, member.RecipientGroupID)
		if err != nil {
			return fmt.Errorf("sync alert recipient members: get group %s: %w", member.RecipientGroupID, err)
		}
		groupsToRegen[group.ID] = group
	}

	for _, group := range groupsToRegen {
		if err := s.RegenerateRulesByRecipientGroup(ctx, group.OrgID, group); err != nil {
			return fmt.Errorf("sync alert recipient members: regenerate group %s: %w", group.ID, err)
		}
	}
	return nil
}
