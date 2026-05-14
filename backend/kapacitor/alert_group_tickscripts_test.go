package kapacitor

import (
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func sampleRule() cloudhub.AlertGroupRule {
	return cloudhub.AlertGroupRule{
		ID:              "rule-1",
		Name:            "cpu high",
		Database:        "Default",
		RetentionPolicy: "autogen",
		Measurement:     "cpu",
		Field:           "usage_idle",
		Conditions: []cloudhub.AlertCondition{
			{Level: "critical", Value: "70", Enabled: true},
		},
		TriggerOperator: "greater",
		TaskType:        "stream",
		Every:           "30s",
		Message:         "cpu high",
	}
}

func TestAlertGroupRuleTICKScriptDropsAlertUdf(t *testing.T) {
	tick, err := AlertGroupRuleTICKScript(sampleRule(), AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, "@alertUdf") {
		t.Fatalf("tickscript must not reference @alertUdf:\n%s", tick)
	}
	if strings.Contains(tick, "groupFilter") {
		t.Fatalf("tickscript must not reference groupFilter mode:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOmitsHostFilterWhenNoHosts(t *testing.T) {
	tick, err := AlertGroupRuleTICKScript(sampleRule(), AlertRecipients{}, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, `"host" ==`) {
		t.Fatalf("tickscript must not emit host filter when hostnames empty:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptInlinesStreamHostFilter(t *testing.T) {
	tick, err := AlertGroupRuleTICKScript(sampleRule(), AlertRecipients{}, []string{"host-a", "host-b"})
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	want := `.where(lambda: "host" == 'host-a' OR "host" == 'host-b')`
	if !strings.Contains(tick, want) {
		t.Fatalf("tickscript must inline stream host filter %q in:\n%s", want, tick)
	}
}

func TestAlertGroupRuleTICKScriptInlinesBatchHostFilter(t *testing.T) {
	r := sampleRule()
	r.TaskType = "batch"
	tick, err := AlertGroupRuleTICKScript(r, AlertRecipients{}, []string{"host-a"})
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	want := `WHERE time > -30s AND ("host" = 'host-a')`
	if !strings.Contains(tick, want) {
		t.Fatalf("tickscript must inline batch host filter %q in:\n%s", want, tick)
	}
}

func TestAlertGroupRuleTICKScriptEmbedsCriticalRecipients(t *testing.T) {
	rec := AlertRecipients{Crit: []string{"a@x.com", "b@x.com"}}
	tick, err := AlertGroupRuleTICKScript(sampleRule(), rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if !strings.Contains(tick, "|where(lambda: \"level\" == 'CRITICAL')") {
		t.Fatalf("tickscript should branch on CRITICAL:\n%s", tick)
	}
	if !strings.Contains(tick, ".email()") {
		t.Fatalf("tickscript should use email() handler:\n%s", tick)
	}
	if !strings.Contains(tick, ".to('a@x.com')") || !strings.Contains(tick, ".to('b@x.com')") {
		t.Fatalf("tickscript should embed both critical recipients:\n%s", tick)
	}
	if !strings.Contains(tick, ".crit(lambda: TRUE)") {
		t.Fatalf("tickscript critical email branch should set crit lambda:\n%s", tick)
	}
}

func TestAlertGroupRuleTICKScriptOmitsLevelBranchWhenEmpty(t *testing.T) {
	rec := AlertRecipients{Crit: []string{"a@x.com"}}
	tick, err := AlertGroupRuleTICKScript(sampleRule(), rec, nil)
	if err != nil {
		t.Fatalf("AlertGroupRuleTICKScript: %v", err)
	}
	if strings.Contains(tick, "\"level\" == 'WARNING'") {
		t.Fatalf("tickscript should omit WARNING branch when warn list is empty:\n%s", tick)
	}
	if strings.Contains(tick, "\"level\" == 'INFO'") {
		t.Fatalf("tickscript should omit INFO branch when info list is empty:\n%s", tick)
	}
}
