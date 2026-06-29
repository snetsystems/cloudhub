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
