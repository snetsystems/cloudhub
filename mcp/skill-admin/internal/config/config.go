package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const defaultListenAddr = ":8080"

// Config is the whole configuration surface of the skill-admin MCP server.
type Config struct {
	// WorkspaceRoot is the absolute directory agent workspaces live under.
	// An agent's workspace is <WorkspaceRoot>/<agentId>, matching how CloudHub
	// provisions them. Only this directory is mounted, so nothing outside it
	// can be reached whatever the caller asks for.
	WorkspaceRoot   string
	ServerAuthToken string
	ListenAddr      string
}

// Load reads the configuration from the environment.
//
// SKILL_ADMIN_WORKSPACE_ROOT is the absolute directory agent workspaces live
// under, for example "/workspaces". A per-agent allowlist is not workable:
// CloudHub creates an organization's agent at runtime and cannot rewrite this
// server's environment to add it.
func Load() (Config, error) {
	workspaceRoot, err := requiredEnvironment("SKILL_ADMIN_WORKSPACE_ROOT")
	if err != nil {
		return Config{}, err
	}
	if !filepath.IsAbs(workspaceRoot) {
		return Config{}, fmt.Errorf("SKILL_ADMIN_WORKSPACE_ROOT must be an absolute path, got %q", workspaceRoot)
	}
	serverAuthToken, err := requiredEnvironment("MCP_SERVER_AUTH_TOKEN")
	if err != nil {
		return Config{}, err
	}

	listenAddr := strings.TrimSpace(os.Getenv("MCP_LISTEN_ADDR"))
	if listenAddr == "" {
		listenAddr = defaultListenAddr
	}

	return Config{
		WorkspaceRoot:   filepath.Clean(workspaceRoot),
		ServerAuthToken: serverAuthToken,
		ListenAddr:      listenAddr,
	}, nil
}

func requiredEnvironment(name string) (string, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	return value, nil
}
