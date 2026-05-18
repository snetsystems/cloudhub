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

// ResolveAlertRecipients walks the recipient groups, looks up each member's
// alert preferences in prefs (keyed by RecipientGroupMember.ID), and buckets
// emails by EmailLevel into the AlertRecipients lists.
//
// EmailLevel mapping:
//
//	"all" or empty -> info, warn, crit
//	"warning"      -> warn, crit
//	"critical"     -> crit
//	anything else  -> ignored
//
// Members without a prefs entry or with EmailEnabled=false are skipped.
// Final lists are dedup'd case-insensitively and trimmed.
func ResolveAlertRecipients(rule cloudhub.AlertGroupRule, groups []cloudhub.RecipientGroup, prefs map[string]cloudhub.AlertRecipientMemberPrefs) AlertRecipients {
	_ = rule // rule is reserved for future filtering (e.g., by KapacitorID) — current logic depends only on groups+prefs.

	var info, warn, crit recipientBucket
	for _, g := range groups {
		for _, m := range g.Members {
			addr := strings.TrimSpace(m.Email)
			if addr == "" {
				continue
			}
			p, ok := prefs[m.ID]
			if !ok || !p.EmailEnabled {
				continue
			}
			switch strings.ToLower(strings.TrimSpace(p.EmailLevel)) {
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
