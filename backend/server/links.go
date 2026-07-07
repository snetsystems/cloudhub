package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type getFluxLinksResponse struct {
	AST         string `json:"ast"`
	Self        string `json:"self"`
	Suggestions string `json:"suggestions"`
}

type getConfigLinksResponse struct {
	Self string `json:"self"` // Location of the whole global application configuration
	Auth string `json:"auth"` // Location of the auth section of the global application configuration
}

type getOrganizationConfigLinksResponse struct {
	Self      string `json:"self"`      // Location of the organization configuration
	LogViewer string `json:"logViewer"` // Location of the organization-specific log viewer configuration
}

type getExternalLinksResponse struct {
	StatusFeed  *string      `json:"statusFeed,omitempty"` // Location of the a JSON Feed for client's Status page News Feed
	CustomLinks []CustomLink `json:"custom,omitempty"`     // Any custom external links for client's User menu
}

// CustomLink is a handler that returns a custom link to be used in server's routes response, within ExternalLinks
type CustomLink struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// NewCustomLinks transforms `--custom-link` CLI flag data or `CUSTOM_LINKS` ENV
// var data into a data structure that the CloudHub client will expect
func NewCustomLinks(links map[string]string) ([]CustomLink, error) {
	customLinks := make([]CustomLink, 0, len(links))
	for name, link := range links {
		if name == "" {
			return nil, errors.New("CustomLink missing key for Name")
		}
		if link == "" {
			return nil, errors.New("CustomLink missing value for URL")
		}
		_, err := url.Parse(link)
		if err != nil {
			return nil, err
		}

		customLink := CustomLink{
			Name: name,
			URL:  link,
		}
		customLinks = append(customLinks, customLink)
	}

	return customLinks, nil
}

// RetryPolicy retry policy server option
type RetryPolicy struct {
	Name   string `json:"name"`
	Policy string `json:"policy"`
}

// RetryPolicys all retry oplicy
type RetryPolicys []RetryPolicy

type getAddonLinksResponse struct {
	Name  string `json:"name"`
	URL   string `json:"url"`
	Token string `json:"token"` // [Deprecated] Token is not going to transfer the client(frontend).
}

// OSP is to access to OpenStack API
type OSP struct {
	AdminProvider string `json:"admin-provider"`
	AdminUser     string `json:"admin-user"`
	AdminPW       string `json:"admin-pw"`
	AuthURL       string `json:"auth-url"`
	ProjectDomain string `json:"pj-domain-id"`
	UserDomain    string `json:"user-domain-id"`
}

// NewOSP converts map to OSP Struct
func NewOSP(osp map[string]string) OSP {
	var newOsp OSP
	if len(osp) > 0 {
		newOsp.AdminProvider = osp["admin-provider"]
		newOsp.AdminUser = osp["admin-user"]
		newOsp.AdminPW = osp["admin-pw"]
		newOsp.AuthURL = osp["auth-url"]
		newOsp.ProjectDomain = osp["pj-domain-id"]
		newOsp.UserDomain = osp["user-domain-id"]
	}

	return newOsp
}

// NewAIConfig converts map to AI Struct
func NewAIConfig(aiConfig map[string]string) cloudhub.AIConfig {
	var newAiConfig cloudhub.AIConfig
	if len(aiConfig) > 0 {
		newAiConfig.DockerPath = aiConfig["docker-path"]
		newAiConfig.LogstashPath = aiConfig["logstash-path"]
		newAiConfig.DockerCmd = aiConfig["docker-cmd"]
		newAiConfig.PredictionRegex = aiConfig["prediction-regex"]
	}

	return newAiConfig
}

// NewURLMonitoringConfig converts map to URLMonitoringConfig Struct
func NewURLMonitoringConfig(cfg map[string]string) cloudhub.URLMonitoringConfig {
	c := cloudhub.URLMonitoringConfig{
		TelegrafPath: "/etc/telegraf/telegraf.d",
	}
	if p := cfg["telegraf-path"]; p != "" {
		c.TelegrafPath = p
	}
	if v := cfg["insecure-skip-verify"]; v == "true" {
		c.InsecureSkipVerify = true
	}
	if v := cfg["tls-ca"]; v != "" {
		c.TLSCA = v
	}
	if v := cfg["tls-cert"]; v != "" {
		c.TLSCert = v
	}
	if v := cfg["tls-key"]; v != "" {
		c.TLSKey = v
	}
	return c
}

// NewKubernetesConfig converts map to Kubernetes Struct
func NewKubernetesConfig(kubernetesConfig map[string]string) cloudhub.KubernetesConfig {
	var newKubernetesConfig cloudhub.KubernetesConfig
	if len(kubernetesConfig) > 0 {
		newKubernetesConfig.URL = kubernetesConfig["url"]
		newKubernetesConfig.Token = kubernetesConfig["token"]
		if kubernetesConfig["insecure-skip-verify"] == "true" {
			newKubernetesConfig.InsecureSkipVerify = true
		}
	}

	return newKubernetesConfig
}

// hubbleClustersFile is the JSON shape for CLOUDHUB_HUBBLE_CLUSTERS_FILE.
type hubbleClustersFile struct {
	Clusters []cloudhub.HubbleClusterConfig `json:"clusters"`
}

// defaultHubbleExcludedNSGlobs marks the canonical Kubernetes system
// namespaces so the UI's "Hide system NS" filter works without configuration.
var defaultHubbleExcludedNSGlobs = []string{
	"kube-system",
	"kube-public",
	"kube-node-lease",
}

// hubbleClusterFromMap builds a single-cluster config from --hubble key-value flags.
func hubbleClusterFromMap(m map[string]string) (cloudhub.HubbleClusterConfig, bool) {
	relayURL := m["relay-url"]
	if relayURL == "" {
		return cloudhub.HubbleClusterConfig{}, false
	}
	name := m["cluster"]
	if name == "" {
		name = "default"
	}
	return cloudhub.HubbleClusterConfig{
		Name:               name,
		RelayURL:           relayURL,
		TLSCA:              m["tls-ca"],
		TLSCert:            m["tls-cert"],
		TLSKey:             m["tls-key"],
		TLSServerName:      m["tls-server-name"],
		InsecureSkipVerify: m["insecure-skip-verify"] == "true",
		Plaintext:          m["plaintext"] == "true",
	}, true
}

// NewHubbleConfig builds a HubbleConfig from the parsed flags. A single cluster
// can be configured via --hubble=relay-url:… (and related keys). If clustersFile
// is non-empty its "clusters" array is appended for multi-cluster setups.
func NewHubbleConfig(
	window, bucket, snapshotInterval time.Duration,
	maxEdges int,
	excludedGlobs []string,
	hubble map[string]string,
	clustersFile string,
) (cloudhub.HubbleConfig, error) {
	if len(excludedGlobs) == 0 {
		excludedGlobs = defaultHubbleExcludedNSGlobs
	}
	cfg := cloudhub.HubbleConfig{
		Window:                 window,
		Bucket:                 bucket,
		SnapshotInterval:       snapshotInterval,
		MaxEdgesPerCluster:     maxEdges,
		ExcludedNamespaceGlobs: excludedGlobs,
	}
	if cluster, ok := hubbleClusterFromMap(hubble); ok {
		cfg.Clusters = append(cfg.Clusters, cluster)
	}
	if clustersFile == "" {
		return cfg, nil
	}
	raw, err := os.ReadFile(clustersFile)
	if err != nil {
		return cfg, fmt.Errorf("hubble clusters file: %w", err)
	}
	var parsed hubbleClustersFile
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return cfg, fmt.Errorf("hubble clusters file: %w", err)
	}
	cfg.Clusters = append(cfg.Clusters, parsed.Clusters...)
	return cfg, nil
}
