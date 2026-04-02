package cloudhub

import (
	"fmt"
	"strings"
)

// Normalized deploy topology for DEPLOY_PLATFORM / --deploy-platform (see NormalizeDeployPlatform).
const (
	DeployPlatformK8s  = "k8s"
	DeployPlatformHost = "host"
)

// DeployPlatformInputKubernetes is an alternate spelling accepted for DeployPlatformK8s.
const DeployPlatformInputKubernetes = "kubernetes"

// NormalizeDeployPlatform maps DEPLOY_PLATFORM / --deploy-platform to DeployPlatformK8s or DeployPlatformHost.
// An empty value selects DeployPlatformHost (default).
func NormalizeDeployPlatform(v string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(v))
	switch s {
	case DeployPlatformK8s, DeployPlatformInputKubernetes:
		return DeployPlatformK8s, nil
	case "", DeployPlatformHost:
		return DeployPlatformHost, nil
	default:
		return "", fmt.Errorf("invalid deploy-platform %q: use %q or %q",
			v, DeployPlatformK8s, DeployPlatformHost)
	}
}
