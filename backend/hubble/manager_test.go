package hubble

import (
	"context"
	"testing"
	"time"
)

func TestManager_StartsRuntimePerCluster(t *testing.T) {
	cfg := ManagerConfig{
		Window:           5 * time.Second,
		Bucket:           1 * time.Second,
		SnapshotInterval: 200 * time.Millisecond,
		MaxEdges:         100,
		Clusters: []ClusterConfig{
			{Name: "a", Client: ClientConfig{RelayURL: "127.0.0.1:0"}},
			{Name: "b", Client: ClientConfig{RelayURL: "127.0.0.1:0"}},
		},
	}
	m := NewManager(cfg, NoopLogger{})

	if got := m.ClusterNames(); len(got) != 2 {
		t.Fatalf("got %v clusters, want 2", got)
	}
	if m.Runtime("a") == nil || m.Runtime("b") == nil {
		t.Fatal("missing runtimes")
	}
	if m.Runtime("nonexistent") != nil {
		t.Fatal("expected nil for unknown")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	_ = m.Start(ctx) // dial will fail; that's OK for this test
}
