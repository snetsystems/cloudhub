package server

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// regenRuleSyncHook is set only by tests in this package to bypass Kapacitor HTTP.
// It is always nil in production binaries.
var regenRuleSyncHook func(ctx context.Context, rule cloudhub.AlertGroupRule) error

// RegenerateRulesByUserGroup regenerates tickscripts of all alert rules directly
// linked to the given user_group via alert_rule_user_groups. Per-rule failures
// are logged and skipped — one bad rule does not block the others.
func (s *Service) RegenerateRulesByUserGroup(ctx context.Context, orgID string, group cloudhub.UserGroup) error {
	if s.AlertGroupRules == nil {
		return nil
	}
	rules, err := s.AlertGroupRules.RulesByUserGroup(ctx, group.ID)
	if err != nil {
		return fmt.Errorf("RegenerateRulesByUserGroup: list rules: %w", err)
	}
	for _, rule := range rules {
		if orgID != "" && rule.OrgID != "" && rule.OrgID != orgID {
			continue
		}
		if err := s.regenRule(ctx, rule); err != nil {
			s.Logger.Error(fmt.Sprintf("RegenerateRulesByUserGroup: rule=%s err=%v", rule.ID, err))
		}
	}
	return nil
}

func (s *Service) regenRule(ctx context.Context, rule cloudhub.AlertGroupRule) error {
	if regenRuleSyncHook != nil {
		return regenRuleSyncHook(ctx, rule)
	}
	recipients, err := s.resolveRuleRecipients(ctx, rule)
	if err != nil {
		return fmt.Errorf("resolve recipients: %w", err)
	}
	return s.syncKapacitorTask(ctx, rule, recipients)
}
