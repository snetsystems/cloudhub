package pgsql_test

import (
	"context"
	"os"
	"testing"

	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func TestClientPing(t *testing.T) {
	dsn := os.Getenv("TEST_PGSQL_DSN")
	if dsn == "" {
		t.Skip("TEST_PGSQL_DSN not set")
	}

	ctx := context.Background()
	client, err := pgsql.NewClient(ctx, dsn)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	defer client.Close()

	if err := client.Ping(ctx); err != nil {
		t.Fatalf("Ping: %v", err)
	}
}

func TestClientCopyFrom(t *testing.T) {
	dsn := os.Getenv("TEST_PGSQL_DSN")
	if dsn == "" {
		t.Skip("TEST_PGSQL_DSN not set")
	}
	ctx := context.Background()
	client, err := pgsql.NewClient(ctx, dsn)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	defer client.Close()
	rows := [][]any{
		{"minion-bulk-1", "host1", "linux", "20.04", "amd64", int64(1024), 2, "default"},
		{"minion-bulk-2", "host2", "linux", "20.04", "amd64", int64(2048), 4, "default"},
	}
	columns := []string{"minion_id", "hostname", "os", "os_version", "arch", "mem_total_kb", "cpu_cores", "org_id"}

	n, err := client.CopyFrom(ctx, "agents", columns, rows)
	if err != nil {
		t.Fatalf("CopyFrom: %v", err)
	}
	if n != 2 {
		t.Fatalf("expected 2 rows inserted, got %d", n)
	}
	// cleanup
	_, _ = client.ExecContext(ctx, "DELETE FROM agents WHERE minion_id LIKE 'minion-bulk-%'")
}
