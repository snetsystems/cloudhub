package config

import (
	"testing"
)

// This fails if the workspace root stops being validated. Everything the
// server will delete is resolved under it, so a relative or empty root would
// resolve targets against the process working directory.
func TestLoadReadsAnAbsoluteWorkspaceRoot(t *testing.T) {
	t.Setenv("SKILL_ADMIN_WORKSPACE_ROOT", "/workspaces/")
	t.Setenv("MCP_SERVER_AUTH_TOKEN", "token")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.WorkspaceRoot != "/workspaces" {
		t.Fatalf("WorkspaceRoot = %q, want it cleaned", cfg.WorkspaceRoot)
	}
	if cfg.ListenAddr != defaultListenAddr {
		t.Fatalf("ListenAddr = %q, want %q", cfg.ListenAddr, defaultListenAddr)
	}
}

func TestLoadRejectsAnUnusableWorkspaceRoot(t *testing.T) {
	for name, root := range map[string]string{
		"empty":    "",
		"blank":    "   ",
		"relative": "workspaces",
	} {
		t.Run(name, func(t *testing.T) {
			t.Setenv("SKILL_ADMIN_WORKSPACE_ROOT", root)
			t.Setenv("MCP_SERVER_AUTH_TOKEN", "token")
			if _, err := Load(); err == nil {
				t.Fatalf("Load accepted root %q", root)
			}
		})
	}
}

func TestLoadRequiresAnAuthToken(t *testing.T) {
	t.Setenv("SKILL_ADMIN_WORKSPACE_ROOT", "/workspaces")
	t.Setenv("MCP_SERVER_AUTH_TOKEN", "")
	if _, err := Load(); err == nil {
		t.Fatal("Load accepted an empty MCP_SERVER_AUTH_TOKEN")
	}
}
