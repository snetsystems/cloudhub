package server

import (
	"context"
	"fmt"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// TargetProcessor defines the strategy for handling rule targets (Host vs URL)
type TargetProcessor interface {
	// Type returns the target type (e.g., "host", "url")
	Type() string
	// SaveTargets saves the list of target identifiers for a given rule
	SaveTargets(ctx context.Context, ruleID string, targets []string) error
	// LoadTargets loads the list of target identifiers for a given rule
	LoadTargets(ctx context.Context, ruleID string) ([]string, error)
	// BuildTickscriptFilter builds the lambda expression for filtering targets in TICKscript
	BuildTickscriptFilter(targets []string) string
}

// HostTargetProcessor implements TargetProcessor for Host-based alert rules
type HostTargetProcessor struct {
	Store cloudhub.AlertGroupRuleStore
}

func (p *HostTargetProcessor) Type() string {
	return "host"
}

func (p *HostTargetProcessor) SaveTargets(ctx context.Context, ruleID string, targets []string) error {
	return p.Store.SetHosts(ctx, ruleID, targets)
}

func (p *HostTargetProcessor) LoadTargets(ctx context.Context, ruleID string) ([]string, error) {
	return p.Store.Hostnames(ctx, ruleID)
}

func (p *HostTargetProcessor) BuildTickscriptFilter(targets []string) string {
	if len(targets) == 0 {
		return ""
	}
	// Builds `("host" == 'node1' OR "host" == 'node2')`
	var conditions []string
	for _, t := range targets {
		conditions = append(conditions, fmt.Sprintf(`"host" == '%s'`, t))
	}
	return fmt.Sprintf("(%s)", strings.Join(conditions, " OR "))
}

// URLTargetProcessor implements TargetProcessor for URL-based alert rules
type URLTargetProcessor struct {
	Store cloudhub.AlertGroupRuleStore
}

func (p *URLTargetProcessor) Type() string {
	return "url"
}

func (p *URLTargetProcessor) SaveTargets(ctx context.Context, ruleID string, targets []string) error {
	return p.Store.SetURLTargets(ctx, ruleID, targets)
}

func (p *URLTargetProcessor) LoadTargets(ctx context.Context, ruleID string) ([]string, error) {
	return p.Store.URLTargetIDs(ctx, ruleID)
}

func (p *URLTargetProcessor) BuildTickscriptFilter(targets []string) string {
	if len(targets) == 0 {
		return ""
	}
	// Builds `("target_id" == 'uuid-1' OR "target_id" == 'uuid-2')`
	var conditions []string
	for _, t := range targets {
		conditions = append(conditions, fmt.Sprintf(`"target_id" == '%s'`, t))
	}
	return fmt.Sprintf("(%s)", strings.Join(conditions, " OR "))
}
