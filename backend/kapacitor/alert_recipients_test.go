package kapacitor

import (
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestResolveAlertRecipients_DirectInputGoesToAllLevels(t *testing.T) {
	rule := cloudhub.AlertGroupRule{
		Recipients: []string{"direct@x.com"},
	}
	got := ResolveAlertRecipients(rule, nil)
	want := AlertRecipients{
		Info: []string{"direct@x.com"},
		Warn: []string{"direct@x.com"},
		Crit: []string{"direct@x.com"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ResolveAlertRecipients direct: got %+v want %+v", got, want)
	}
}

func TestResolveAlertRecipients_UserGroupLevelBuckets(t *testing.T) {
	rule := cloudhub.AlertGroupRule{}
	groups := []cloudhub.UserGroup{{
		Members: []cloudhub.UserGroupMember{
			{Email: "all@x.com", EmailEnabled: true, EmailLevel: "all"},
			{Email: "warn@x.com", EmailEnabled: true, EmailLevel: "warning"},
			{Email: "crit@x.com", EmailEnabled: true, EmailLevel: "critical"},
			{Email: "off@x.com", EmailEnabled: false, EmailLevel: "all"},
		},
	}}
	got := ResolveAlertRecipients(rule, groups)
	want := AlertRecipients{
		Info: []string{"all@x.com"},
		Warn: []string{"all@x.com", "warn@x.com"},
		Crit: []string{"all@x.com", "warn@x.com", "crit@x.com"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ResolveAlertRecipients groups: got %+v want %+v", got, want)
	}
}

func TestResolveAlertRecipients_DedupAcrossSources(t *testing.T) {
	rule := cloudhub.AlertGroupRule{Recipients: []string{"shared@x.com", "Shared@X.com"}}
	groups := []cloudhub.UserGroup{{
		Members: []cloudhub.UserGroupMember{
			{Email: "shared@x.com", EmailEnabled: true, EmailLevel: "all"},
		},
	}}
	got := ResolveAlertRecipients(rule, groups)
	if len(got.Crit) != 1 || got.Crit[0] != "shared@x.com" {
		t.Fatalf("expected single crit recipient after dedup, got %+v", got.Crit)
	}
	if len(got.Info) != 1 || len(got.Warn) != 1 {
		t.Fatalf("expected single recipient per level, got info=%v warn=%v", got.Info, got.Warn)
	}
}

func TestResolveAlertRecipients_TrimsAndIgnoresEmpty(t *testing.T) {
	rule := cloudhub.AlertGroupRule{Recipients: []string{"  ok@x.com  ", "", "   "}}
	got := ResolveAlertRecipients(rule, nil)
	if len(got.Crit) != 1 || got.Crit[0] != "ok@x.com" {
		t.Fatalf("expected trimmed single recipient, got %+v", got.Crit)
	}
}
