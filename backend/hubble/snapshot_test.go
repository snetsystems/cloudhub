package hubble

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestSnapshot_JSONFieldNames(t *testing.T) {
	s := &Snapshot{
		Kind:        "overview",
		ClusterName: "prod",
		SnapshotAt:  time.Date(2026, 6, 18, 10, 0, 0, 0, time.UTC),
		Window: SnapshotWindow{
			Start:  time.Date(2026, 6, 18, 9, 55, 0, 0, time.UTC),
			End:    time.Date(2026, 6, 18, 10, 0, 0, 0, time.UTC),
			Filled: 0.5,
		},
	}
	b, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	for _, want := range []string{`"kind":"overview"`, `"clusterName":"prod"`, `"window":`, `"filled":0.5`} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in %s", want, got)
		}
	}
}

func TestTopN_OrdersByCountDescending(t *testing.T) {
	in := map[string]int64{"a": 1, "b": 5, "c": 3}
	got := topN(in, 2)
	if len(got) != 2 || got[0].Name != "b" || got[1].Name != "c" {
		t.Fatalf("unexpected: %+v", got)
	}
}

func TestSnapshotEdge_MetricsJSONFieldNames(t *testing.T) {
	e := SnapshotEdge{
		ActiveConns: 2,
		L7Metrics: []L7Metric{
			{Type: "HTTP", Count: 3, AvgLatencyMs: 6, MaxLatencyMs: 8},
		},
		TopExternalIPs: []NamedCount{{Name: "203.0.113.9", Count: 2}},
	}
	b, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	for _, want := range []string{
		`"activeConns":2`, `"l7Metrics":`, `"type":"HTTP"`,
		`"avgLatencyMs":6`, `"maxLatencyMs":8`,
		`"topExternalIPs":[{"name":"203.0.113.9","count":2}]`,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in %s", want, got)
		}
	}
}

func TestMakeNode_SystemFlag(t *testing.T) {
	isSystem := func(ns string) bool { return ns == "kube-system" }

	tests := []struct {
		id         string
		lvl        Level
		wantSystem bool
	}{
		{"ns:kube-system", LevelNamespace, true},
		{"ns:cloudhub", LevelNamespace, false},
		{"wl:kube-system/coredns", LevelWorkload, true},
		{"wl:cloudhub/backend", LevelWorkload, false},
	}
	for _, tt := range tests {
		got := makeNode(tt.id, tt.lvl, isSystem)
		if got.System != tt.wantSystem {
			t.Errorf("makeNode(%q).System = %v, want %v", tt.id, got.System, tt.wantSystem)
		}
	}
}

func TestMakeNode_ReservedExternalLabels(t *testing.T) {
	tests := []struct {
		id    string
		label string
	}{
		{id: "ext:reserved:host", label: "Host"},
		{id: "ext:world", label: "World"},
		{id: "ext:reserved:remote-node", label: "Remote Node"},
		{id: "ext:reserved:kube-apiserver", label: "Kubernetes API Server"},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			got := makeNode(tt.id, LevelWorkload, nil)
			if got.Kind != "external" || got.Label != tt.label {
				t.Fatalf("makeNode(%q) = kind %q label %q, want external %q", tt.id, got.Kind, got.Label, tt.label)
			}
		})
	}
}
