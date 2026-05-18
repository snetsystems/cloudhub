package kapacitor

import (
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestResolveAlertRecipients_LevelBuckets(t *testing.T) {
	rule := cloudhub.AlertGroupRule{}
	groups := []cloudhub.RecipientGroup{{ID: "g1", Members: []cloudhub.RecipientGroupMember{
		{ID: "m1", Email: "all@x.com"},
		{ID: "m2", Email: "warn@x.com"},
		{ID: "m3", Email: "crit@x.com"},
		{ID: "m4", Email: "off@x.com"},
	}}}
	prefs := map[string]cloudhub.AlertRecipientMemberPrefs{
		"m1": {EmailEnabled: true, EmailLevel: "all"},
		"m2": {EmailEnabled: true, EmailLevel: "warning"},
		"m3": {EmailEnabled: true, EmailLevel: "critical"},
		"m4": {EmailEnabled: false, EmailLevel: "all"},
	}
	got := ResolveAlertRecipients(rule, groups, prefs)
	want := AlertRecipients{
		Info: []string{"all@x.com"},
		Warn: []string{"all@x.com", "warn@x.com"},
		Crit: []string{"all@x.com", "warn@x.com", "crit@x.com"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v want %+v", got, want)
	}
}

func TestResolveAlertRecipients_DedupCaseInsensitive(t *testing.T) {
	rule := cloudhub.AlertGroupRule{}
	groups := []cloudhub.RecipientGroup{{ID: "g1", Members: []cloudhub.RecipientGroupMember{
		{ID: "m1", Email: "Shared@X.com"},
		{ID: "m2", Email: "shared@x.com"},
	}}}
	prefs := map[string]cloudhub.AlertRecipientMemberPrefs{
		"m1": {EmailEnabled: true, EmailLevel: "all"},
		"m2": {EmailEnabled: true, EmailLevel: "all"},
	}
	got := ResolveAlertRecipients(rule, groups, prefs)
	if len(got.Crit) != 1 {
		t.Fatalf("expected single crit after dedup, got %+v", got.Crit)
	}
}

func TestResolveAlertRecipients_SkipsMembersWithoutPrefs(t *testing.T) {
	rule := cloudhub.AlertGroupRule{}
	groups := []cloudhub.RecipientGroup{{ID: "g1", Members: []cloudhub.RecipientGroupMember{
		{ID: "m1", Email: "noprefs@x.com"},
		{ID: "m2", Email: "ok@x.com"},
	}}}
	prefs := map[string]cloudhub.AlertRecipientMemberPrefs{
		"m2": {EmailEnabled: true, EmailLevel: "all"},
	}
	got := ResolveAlertRecipients(rule, groups, prefs)
	if len(got.Crit) != 1 || got.Crit[0] != "ok@x.com" {
		t.Fatalf("expected only ok@x.com, got %+v", got.Crit)
	}
}

func TestResolveAlertRecipients_TrimsAndIgnoresEmpty(t *testing.T) {
	rule := cloudhub.AlertGroupRule{}
	groups := []cloudhub.RecipientGroup{{ID: "g1", Members: []cloudhub.RecipientGroupMember{
		{ID: "m1", Email: "  ok@x.com  "},
		{ID: "m2", Email: ""},
		{ID: "m3", Email: "   "},
	}}}
	prefs := map[string]cloudhub.AlertRecipientMemberPrefs{
		"m1": {EmailEnabled: true, EmailLevel: "all"},
		"m2": {EmailEnabled: true, EmailLevel: "all"},
		"m3": {EmailEnabled: true, EmailLevel: "all"},
	}
	got := ResolveAlertRecipients(rule, groups, prefs)
	if len(got.Crit) != 1 || got.Crit[0] != "ok@x.com" {
		t.Fatalf("expected trimmed single recipient, got %+v", got.Crit)
	}
}
