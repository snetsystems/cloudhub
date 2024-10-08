package server

import (
	"errors"
	"net/url"

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
