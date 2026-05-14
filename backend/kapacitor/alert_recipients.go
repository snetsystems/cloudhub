package kapacitor

import (
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// AlertRecipients holds level-bucketed email recipient lists for tickscript embedding.
// Each list is dedup'd case-insensitively and preserves insertion order.
type AlertRecipients struct {
	Info []string
	Warn []string
	Crit []string
}

// ResolveAlertRecipients merges direct-input recipients (always all-levels) with
// user_group members (bucketed by EmailLevel) into level-specific lists.
//
// EmailLevel mapping:
//
//	"all" or empty -> info, warn, crit
//	"warning"      -> warn, crit
//	"critical"     -> crit
//	anything else  -> ignored
//
// Members with EmailEnabled=false or empty Email are skipped.
// Direct-input recipients (rule.Recipients) are treated as "all".
// Final lists are dedup'd case-insensitively and trimmed.
func ResolveAlertRecipients(rule cloudhub.AlertGroupRule, groups []cloudhub.UserGroup) AlertRecipients {
	var info, warn, crit recipientBucket

	for _, raw := range rule.Recipients {
		addr := strings.TrimSpace(raw)
		if addr == "" {
			continue
		}
		info.add(addr)
		warn.add(addr)
		crit.add(addr)
	}

	for _, g := range groups {
		for _, m := range g.Members {
			if !m.EmailEnabled {
				continue
			}
			addr := strings.TrimSpace(m.Email)
			if addr == "" {
				continue
			}
			switch strings.ToLower(strings.TrimSpace(m.EmailLevel)) {
			case "all", "":
				info.add(addr)
				warn.add(addr)
				crit.add(addr)
			case "warning":
				warn.add(addr)
				crit.add(addr)
			case "critical":
				crit.add(addr)
			}
		}
	}

	return AlertRecipients{
		Info: info.list,
		Warn: warn.list,
		Crit: crit.list,
	}
}

type recipientBucket struct {
	seen map[string]bool
	list []string
}

func (b *recipientBucket) add(addr string) {
	if b.seen == nil {
		b.seen = map[string]bool{}
	}
	key := strings.ToLower(addr)
	if b.seen[key] {
		return
	}
	b.seen[key] = true
	b.list = append(b.list, addr)
}
