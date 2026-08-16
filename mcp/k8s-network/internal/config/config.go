package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultListenAddr = ":8080"
	defaultPlanTTL    = 2 * time.Minute
)

type Config struct {
	ProxyURL                string
	ProxyInsecureSkipVerify bool
	AllowedNamespace        string
	ServiceToken            string
	ListenAddr              string
	PlanTTL                 time.Duration
}

func Load() (Config, error) {
	proxyURL, err := requiredEnvironment("CLOUDHUB_KUBERNETES_PROXY_URL")
	if err != nil {
		return Config{}, err
	}
	parsedProxyURL, err := url.Parse(proxyURL)
	if err != nil || parsedProxyURL.Host == "" || (parsedProxyURL.Scheme != "http" && parsedProxyURL.Scheme != "https") {
		return Config{}, fmt.Errorf("CLOUDHUB_KUBERNETES_PROXY_URL must be an absolute HTTP or HTTPS URL")
	}

	allowedNamespace, err := requiredEnvironment("MCP_ALLOWED_NAMESPACE")
	if err != nil {
		return Config{}, err
	}
	serviceToken, err := requiredEnvironment("MCP_SERVICE_TOKEN")
	if err != nil {
		return Config{}, err
	}

	listenAddr := strings.TrimSpace(os.Getenv("MCP_LISTEN_ADDR"))
	if listenAddr == "" {
		listenAddr = defaultListenAddr
	}

	planTTL := defaultPlanTTL
	if rawPlanTTL := strings.TrimSpace(os.Getenv("MCP_PLAN_TTL")); rawPlanTTL != "" {
		planTTL, err = time.ParseDuration(rawPlanTTL)
		if err != nil || planTTL <= 0 {
			return Config{}, fmt.Errorf("MCP_PLAN_TTL must be a positive duration")
		}
	}

	proxyInsecureSkipVerify := false
	if raw := strings.TrimSpace(os.Getenv("CLOUDHUB_PROXY_INSECURE_SKIP_VERIFY")); raw != "" {
		proxyInsecureSkipVerify, err = strconv.ParseBool(raw)
		if err != nil {
			return Config{}, fmt.Errorf("CLOUDHUB_PROXY_INSECURE_SKIP_VERIFY must be true or false")
		}
	}

	return Config{
		ProxyURL:                strings.TrimRight(proxyURL, "/"),
		ProxyInsecureSkipVerify: proxyInsecureSkipVerify,
		AllowedNamespace:        allowedNamespace,
		ServiceToken:            serviceToken,
		ListenAddr:              listenAddr,
		PlanTTL:                 planTTL,
	}, nil
}

func requiredEnvironment(name string) (string, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	return value, nil
}
