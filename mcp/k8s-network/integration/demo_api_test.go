package integration

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"sigs.k8s.io/yaml"
)

const (
	defaultCloudHubBaseURL = "http://10.20.2.72:8888"
	defaultMCPBaseURL      = "http://127.0.0.1:8080"
	defaultHubbleCluster   = "default"
	defaultDemoNamespace   = "network-repair-demo"
	demoPolicyName         = "allow-frontend-to-backend"
)

type demoConfig struct {
	cloudHubBaseURL    string
	authorization      string
	username           string
	password           string
	insecureSkipVerify bool
	mcpBaseURL         string
	hubbleCluster      string
	namespace          string
}

type fixtureResource struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Metadata   struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	} `json:"metadata"`
	JSON []byte `json:"-"`
	YAML []byte `json:"-"`
}

type demoFlow struct {
	Time         time.Time `json:"time"`
	Verdict      string    `json:"verdict"`
	DropReason   string    `json:"dropReason"`
	SrcNamespace string    `json:"srcNamespace"`
	DstNamespace string    `json:"dstNamespace"`
	SrcWorkload  string    `json:"srcWorkload"`
	DstWorkload  string    `json:"dstWorkload"`
	SrcPod       string    `json:"srcPod"`
	DstPod       string    `json:"dstPod"`
}

type openClawEvent struct {
	Type         string `json:"type"`
	SessionID    string `json:"sessionId"`
	State        string `json:"state"`
	ErrorMessage string `json:"errorMessage"`
	Activity     *struct {
		Phase  string `json:"phase"`
		Name   string `json:"name"`
		Status string `json:"status"`
		Error  string `json:"error"`
	} `json:"activity"`
	Approval *struct {
		ID               string   `json:"id"`
		ToolName         string   `json:"toolName"`
		AllowedDecisions []string `json:"allowedDecisions"`
	} `json:"approval"`
}

type demoApproval struct {
	ID               string   `json:"id"`
	ToolName         string   `json:"toolName"`
	AllowedDecisions []string `json:"allowedDecisions"`
}

func TestDemoConfigAcceptsBasicLoginCredentials(t *testing.T) {
	t.Setenv("CLOUDHUB_AUTHORIZATION", "")
	t.Setenv("CLOUDHUB_BASE_URL", "https://localhost:8888")
	t.Setenv("CLOUDHUB_USERNAME", "demo-user")
	t.Setenv("CLOUDHUB_PASSWORD", "demo-password")
	t.Setenv("CLOUDHUB_INSECURE_SKIP_VERIFY", "true")
	t.Setenv("MCP_BASE_URL", "")

	cfg, err := demoConfigFromEnvironment()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.username != "demo-user" || cfg.password != "demo-password" {
		t.Fatal("basic-login credentials were not loaded")
	}
	if !cfg.insecureSkipVerify {
		t.Fatal("CLOUDHUB_INSECURE_SKIP_VERIFY=true was not applied")
	}
	if cfg.mcpBaseURL != "http://127.0.0.1:8080" {
		t.Fatalf("default MCP_BASE_URL = %q, want local 237 container", cfg.mcpBaseURL)
	}
}

func TestAuthenticateCloudHubStoresBasicLoginCookie(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/basic/login" || r.Method != http.MethodPost {
			t.Errorf("request = %s %s, want POST /basic/login", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var request struct {
			Name     string `json:"name"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if request.Name != "demo-user" || request.Password != "demo-password" {
			t.Error("basic-login request did not contain the configured credentials")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "cloudhub-session", Value: "session-value", Path: "/"})
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := demoConfig{
		cloudHubBaseURL: server.URL, username: "demo-user", password: "demo-password",
		insecureSkipVerify: true,
	}
	client, err := newDemoHTTPClient(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err := authenticateCloudHub(context.Background(), client, cfg); err != nil {
		t.Fatal(err)
	}
	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	cookies := client.Jar.Cookies(baseURL)
	if len(cookies) != 1 || cookies[0].Name != "cloudhub-session" {
		t.Fatalf("stored cookies = %#v, want CloudHub session cookie", cookies)
	}
}

func TestOpenClawHeadersReuseLoginCookie(t *testing.T) {
	cfg := demoConfig{cloudHubBaseURL: "https://localhost:8888", insecureSkipVerify: true}
	client, err := newDemoHTTPClient(cfg)
	if err != nil {
		t.Fatal(err)
	}
	baseURL, err := url.Parse(cfg.cloudHubBaseURL + "/cloudhub/v2/openclaw/events/ws")
	if err != nil {
		t.Fatal(err)
	}
	client.Jar.SetCookies(baseURL, []*http.Cookie{{Name: "cloudhub-session", Value: "session-value", Path: "/cloudhub"}})

	header, err := openClawRequestHeaders(client, cfg)
	if err != nil {
		t.Fatal(err)
	}
	request := &http.Request{Header: header}
	cookie, err := request.Cookie("cloudhub-session")
	if err != nil || cookie.Value != "session-value" {
		t.Fatalf("WebSocket cookie = %#v, err = %v", cookie, err)
	}
}

func TestRunDemoScriptMapsTestEnvWithoutSourcing(t *testing.T) {
	temporaryDirectory := t.TempDir()
	markerPath := filepath.Join(temporaryDirectory, "env-was-sourced")
	envPath := filepath.Join(temporaryDirectory, "test.env")
	envContents := strings.Join([]string{
		"CLOUDHUB_URL=https://cloudhub.example:8888",
		"CLOUDHUB_USERNAME=demo-user",
		"CLOUDHUB_PASSWORD=demo-password",
		"CLOUDHUB_INSECURE_SKIP_VERIFY=true",
		"UNUSED=$(touch " + markerPath + ")",
	}, "\n") + "\n"
	if err := os.WriteFile(envPath, []byte(envContents), 0600); err != nil {
		t.Fatal(err)
	}

	capturePath := filepath.Join(temporaryDirectory, "captured-environment")
	stubGoPath := filepath.Join(temporaryDirectory, "go")
	stubGo := `#!/usr/bin/env bash
set -euo pipefail
{
  printf 'RUN_DEMO_E2E=%s\n' "${RUN_DEMO_E2E:-}"
  printf 'CLOUDHUB_BASE_URL=%s\n' "${CLOUDHUB_BASE_URL:-}"
  printf 'CLOUDHUB_INSECURE_SKIP_VERIFY=%s\n' "${CLOUDHUB_INSECURE_SKIP_VERIFY:-}"
  printf 'CLOUDHUB_USERNAME_SET=%s\n' "${CLOUDHUB_USERNAME:+yes}"
  printf 'CLOUDHUB_PASSWORD_SET=%s\n' "${CLOUDHUB_PASSWORD:+yes}"
  printf 'MCP_BASE_URL=%s\n' "${MCP_BASE_URL:-}"
  printf 'HUBBLE_CLUSTER=%s\n' "${HUBBLE_CLUSTER:-}"
  printf 'DEMO_NAMESPACE=%s\n' "${DEMO_NAMESPACE:-}"
  printf 'ARGS=%s\n' "$*"
} > "${DEMO_TEST_CAPTURE}"
`
	if err := os.WriteFile(stubGoPath, []byte(stubGo), 0700); err != nil {
		t.Fatal(err)
	}

	command := exec.Command("bash", "run-demo.sh")
	command.Dir = "."
	blockedVariables := []string{
		"CLOUDHUB_URL", "CLOUDHUB_BASE_URL", "CLOUDHUB_AUTHORIZATION", "CLOUDHUB_USERNAME",
		"CLOUDHUB_PASSWORD", "CLOUDHUB_INSECURE_SKIP_VERIFY", "MCP_BASE_URL", "HUBBLE_CLUSTER",
		"DEMO_NAMESPACE", "RUN_DEMO_E2E",
	}
	for _, entry := range os.Environ() {
		keep := true
		for _, variable := range blockedVariables {
			if strings.HasPrefix(entry, variable+"=") {
				keep = false
				break
			}
		}
		if keep {
			command.Env = append(command.Env, entry)
		}
	}
	command.Env = append(command.Env,
		"PATH="+temporaryDirectory+":"+os.Getenv("PATH"),
		"DEMO_ENV_FILE="+envPath,
		"DEMO_TEST_CAPTURE="+capturePath,
	)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("run demo script: %v: %s", err, output)
	}
	captured, err := os.ReadFile(capturePath)
	if err != nil {
		t.Fatal(err)
	}
	wantLines := []string{
		"RUN_DEMO_E2E=1",
		"CLOUDHUB_BASE_URL=https://cloudhub.example:8888",
		"CLOUDHUB_INSECURE_SKIP_VERIFY=true",
		"CLOUDHUB_USERNAME_SET=yes",
		"CLOUDHUB_PASSWORD_SET=yes",
		"MCP_BASE_URL=http://127.0.0.1:8080",
		"HUBBLE_CLUSTER=dev",
		"DEMO_NAMESPACE=network-repair-demo",
		"ARGS=test -count=1 -v ./integration -run ^TestNetworkPolicyRecoveryDemo$",
	}
	for _, want := range wantLines {
		if !strings.Contains(string(captured), want+"\n") {
			t.Fatalf("captured environment is missing %q:\n%s", want, captured)
		}
	}
	if _, err := os.Stat(markerPath); !os.IsNotExist(err) {
		t.Fatalf("test.env was executed as shell code: marker error = %v", err)
	}
}

func TestNetworkPolicyRecoveryDemoFixture(t *testing.T) {
	resources := loadFixture(t, defaultDemoNamespace)
	wantKinds := map[string]int{
		"Namespace": 1, "Deployment": 2, "Service": 1, "NetworkPolicy": 1,
	}
	gotKinds := make(map[string]int)
	for _, resource := range resources {
		gotKinds[resource.Kind]++
	}
	if fmt.Sprint(gotKinds) != fmt.Sprint(wantKinds) {
		t.Fatalf("fixture kinds = %v, want %v", gotKinds, wantKinds)
	}
	if port := policyPort(t, resources); port != 8081 {
		t.Fatalf("fixture NetworkPolicy port = %d, want 8081", port)
	}
}

func TestSendRepairPromptUsesInspectThenRepairTools(t *testing.T) {
	var requestBody struct {
		Message        string `json:"message"`
		IdempotencyKey string `json:"idempotencyKey"`
		TimeoutMS      int    `json:"timeoutMs"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/cloudhub/v2/openclaw/sessions/session-id/messages" {
			t.Errorf("request = %s %s, want POST session messages", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	cfg := demoConfig{cloudHubBaseURL: server.URL, authorization: "Bearer test", namespace: "custom-network-repair"}
	sendRepairPrompt(t, context.Background(), server.Client(), cfg, "session-id")

	inspectAt := strings.Index(requestBody.Message, "k8s_network__inspect_network_policy_path")
	repairAt := strings.Index(requestBody.Message, "k8s_network__repair_network_policy_port")
	if inspectAt < 0 || repairAt < 0 || inspectAt >= repairAt {
		t.Fatalf("prompt tool order = %q, want inspect_network_policy_path before repair_network_policy_port", requestBody.Message)
	}
	wantRepairArguments := `{"namespace":"custom-network-repair","sourceWorkload":"frontend","destinationService":"backend","policyName":"allow-frontend-to-backend","expectedCurrentPort":8081,"desiredPort":8080}`
	if !strings.Contains(requestBody.Message, wantRepairArguments) {
		t.Fatalf("prompt = %q, want repair arguments %s", requestBody.Message, wantRepairArguments)
	}
	for _, excluded := range []string{
		"planId", "plan_network_policy_port_repair", "apply_network_policy_repair",
		"verify_network_policy_repair", "idempotencyKey",
	} {
		if strings.Contains(requestBody.Message, excluded) {
			t.Fatalf("prompt unexpectedly contains %q: %q", excluded, requestBody.Message)
		}
	}
	if requestBody.IdempotencyKey == "" {
		t.Fatal("session message is missing its CloudHub idempotency key")
	}
	if requestBody.TimeoutMS != 90000 {
		t.Fatalf("session message timeout = %d, want 90000", requestBody.TimeoutMS)
	}
}

func TestNetworkPolicyRecoveryDemo(t *testing.T) {
	if os.Getenv("RUN_DEMO_E2E") != "1" {
		t.Skip("set RUN_DEMO_E2E=1 to run against the demo environment")
	}
	cfg := loadDemoConfig(t)
	client, err := newDemoHTTPClient(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 7*time.Minute)
	defer cancel()

	t.Logf("checking the MCP service at %s", cfg.mcpBaseURL)
	doRequest(t, ctx, client, cfg, http.MethodGet, cfg.mcpBaseURL+"/healthz", nil, "", http.StatusOK)
	if err := authenticateCloudHub(ctx, client, cfg); err != nil {
		t.Fatalf("authenticate to CloudHub: %v", err)
	}

	t.Log("applying the wrong-port fixture through the CloudHub Kubernetes proxy")
	resources := loadFixture(t, cfg.namespace)
	for _, resource := range resources {
		applyFixtureResource(t, ctx, client, cfg, resource)
	}

	t.Log("waiting for a Hubble POLICY_DENIED flow")
	waitForFlows(t, ctx, client, cfg, func(flows []demoFlow) bool {
		for _, flow := range flows {
			if strings.EqualFold(flow.Verdict, "DROPPED") && strings.EqualFold(flow.DropReason, "POLICY_DENIED") {
				return true
			}
		}
		return false
	})

	t.Log("creating an owned OpenClaw session and subscribing to its events")
	sessionID := createOpenClawSession(t, ctx, client, cfg)
	ws := subscribeOpenClawEvents(t, ctx, client, cfg, sessionID)
	defer ws.Close()
	sendRepairPrompt(t, ctx, client, cfg, sessionID)

	t.Log("waiting for the repair-tool approval through the CloudHub API")
	approval := waitForOpenClawApproval(t, ctx, client, cfg, sessionID)
	if !strings.HasPrefix(approval.ID, "cloudhub:") {
		t.Fatalf("approval ID = %q, want CloudHub-managed approval", approval.ID)
	}
	if approval.ID == "" || !containsString(approval.AllowedDecisions, "allow-once") {
		t.Fatalf("approval does not offer allow-once: %#v", approval)
	}

	if port := getLivePolicyPort(t, ctx, client, cfg); port != 8081 {
		t.Fatalf("NetworkPolicy port before approval = %d, want 8081", port)
	}
	approvals := listOpenClawApprovals(t, ctx, client, cfg, sessionID)
	repairApprovals := 0
	for _, candidate := range approvals {
		if isRepairNetworkPolicyPortTool(candidate.ToolName) {
			repairApprovals++
		}
	}
	if repairApprovals != 1 {
		t.Fatalf("pending repair approvals = %d, want exactly one: %#v", repairApprovals, approvals)
	}

	t.Log("resolving the one-time approval through CloudHub")
	approvalTime := time.Now().UTC()
	resolveApproval(t, ctx, client, cfg, sessionID, approval.ID)
	if approvals := listOpenClawApprovals(t, ctx, client, cfg, sessionID); len(approvals) != 0 {
		t.Fatalf("pending approvals after resolution = %#v, want none", approvals)
	}

	t.Log("waiting for the repair activity")
	waitForRepairActivity(t, ctx, ws)
	if port := getLivePolicyPort(t, ctx, client, cfg); port != 8080 {
		t.Fatalf("NetworkPolicy port after repair = %d, want 8080", port)
	}

	t.Log("waiting for a newer FORWARDED flow with no later drop")
	waitForFlows(t, ctx, client, cfg, func(flows []demoFlow) bool {
		var newestForwarded time.Time
		for _, flow := range flows {
			if flow.Time.After(approvalTime) && strings.EqualFold(flow.Verdict, "FORWARDED") && flow.Time.After(newestForwarded) {
				newestForwarded = flow.Time
			}
		}
		if newestForwarded.IsZero() {
			return false
		}
		for _, flow := range flows {
			if strings.EqualFold(flow.Verdict, "DROPPED") && flow.Time.After(newestForwarded) {
				return false
			}
		}
		return true
	})
}

func loadDemoConfig(t *testing.T) demoConfig {
	t.Helper()
	cfg, err := demoConfigFromEnvironment()
	if err != nil {
		t.Fatal(err)
	}
	return cfg
}

func demoConfigFromEnvironment() (demoConfig, error) {
	cloudHubBaseURL := strings.TrimSpace(os.Getenv("CLOUDHUB_BASE_URL"))
	if cloudHubBaseURL == "" {
		cloudHubBaseURL = envOrDefault("CLOUDHUB_URL", defaultCloudHubBaseURL)
	}
	cfg := demoConfig{
		cloudHubBaseURL: cloudHubBaseURL,
		authorization:   strings.TrimSpace(os.Getenv("CLOUDHUB_AUTHORIZATION")),
		username:        strings.TrimSpace(os.Getenv("CLOUDHUB_USERNAME")),
		password:        os.Getenv("CLOUDHUB_PASSWORD"),
		mcpBaseURL:      envOrDefault("MCP_BASE_URL", defaultMCPBaseURL),
		hubbleCluster:   envOrDefault("HUBBLE_CLUSTER", defaultHubbleCluster),
		namespace:       envOrDefault("DEMO_NAMESPACE", defaultDemoNamespace),
	}
	if cfg.authorization == "" && (cfg.username == "" || cfg.password == "") {
		return demoConfig{}, fmt.Errorf("set CLOUDHUB_AUTHORIZATION or both CLOUDHUB_USERNAME and CLOUDHUB_PASSWORD")
	}
	if raw := strings.TrimSpace(os.Getenv("CLOUDHUB_INSECURE_SKIP_VERIFY")); raw != "" {
		insecureSkipVerify, err := strconv.ParseBool(raw)
		if err != nil {
			return demoConfig{}, fmt.Errorf("CLOUDHUB_INSECURE_SKIP_VERIFY must be true or false")
		}
		cfg.insecureSkipVerify = insecureSkipVerify
	}
	var err error
	cfg.cloudHubBaseURL, err = parseBaseURL("CLOUDHUB_BASE_URL", cfg.cloudHubBaseURL)
	if err != nil {
		return demoConfig{}, err
	}
	cfg.mcpBaseURL, err = parseBaseURL("MCP_BASE_URL", cfg.mcpBaseURL)
	if err != nil {
		return demoConfig{}, err
	}
	return cfg, nil
}

func envOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func parseBaseURL(name, value string) (string, error) {
	parsed, err := url.Parse(strings.TrimRight(value, "/"))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", fmt.Errorf("%s must be an absolute HTTP or HTTPS URL", name)
	}
	return parsed.String(), nil
}

func newDemoHTTPClient(cfg demoConfig) (*http.Client, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("create CloudHub cookie jar: %w", err)
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if cfg.insecureSkipVerify {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} // #nosec G402 -- explicit local demo opt-in
	}
	return &http.Client{Transport: transport, Jar: jar, Timeout: 30 * time.Second}, nil
}

func authenticateCloudHub(ctx context.Context, client *http.Client, cfg demoConfig) error {
	if cfg.authorization != "" {
		return nil
	}
	body, err := json.Marshal(map[string]string{
		"name": cfg.username, "password": cfg.password, "isEncoded": "false",
	})
	if err != nil {
		return fmt.Errorf("encode CloudHub login request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.cloudHubBaseURL+"/basic/login", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create CloudHub login request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("call CloudHub login: %w", err)
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64*1024))
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("CloudHub login returned HTTP %d", response.StatusCode)
	}
	baseURL, err := url.Parse(cfg.cloudHubBaseURL + "/cloudhub/v2/openclaw/events/ws")
	if err != nil {
		return fmt.Errorf("parse CloudHub URL after login: %w", err)
	}
	if len(client.Jar.Cookies(baseURL)) == 0 {
		return fmt.Errorf("CloudHub login returned no session cookie")
	}
	return nil
}

func openClawRequestHeaders(client *http.Client, cfg demoConfig) (http.Header, error) {
	header := make(http.Header)
	if cfg.authorization != "" {
		header.Set("Authorization", cfg.authorization)
		return header, nil
	}
	baseURL, err := url.Parse(cfg.cloudHubBaseURL + "/cloudhub/v2/openclaw/events/ws")
	if err != nil {
		return nil, fmt.Errorf("parse CloudHub URL for WebSocket cookies: %w", err)
	}
	cookies := client.Jar.Cookies(baseURL)
	if len(cookies) == 0 {
		return nil, fmt.Errorf("CloudHub session cookie is missing")
	}
	request := &http.Request{Header: header}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	return header, nil
}

func loadFixture(t *testing.T, namespace string) []fixtureResource {
	t.Helper()
	fixture, err := os.ReadFile(filepath.Join("testdata", "network-repair-demo.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	fixture = bytes.ReplaceAll(fixture, []byte(defaultDemoNamespace), []byte(namespace))
	documents := bytes.Split(fixture, []byte("\n---\n"))
	resources := make([]fixtureResource, 0, len(documents))
	for _, document := range documents {
		jsonDocument, err := yaml.YAMLToJSON(document)
		if err != nil {
			t.Fatalf("convert fixture YAML: %v", err)
		}
		var resource fixtureResource
		if err := json.Unmarshal(jsonDocument, &resource); err != nil {
			t.Fatalf("decode fixture resource: %v", err)
		}
		if resource.APIVersion == "" || resource.Kind == "" || resource.Metadata.Name == "" {
			t.Fatalf("fixture resource is missing identity: %s", jsonDocument)
		}
		resource.JSON = jsonDocument
		resource.YAML = append([]byte(nil), document...)
		resources = append(resources, resource)
	}
	return resources
}

func applyFixtureResource(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig, resource fixtureResource) {
	t.Helper()
	apiPath := fixtureAPIPath(t, resource)
	endpoint := cloudHubKubernetesURL(cfg, apiPath) + "?fieldManager=cloudhub-network-repair-demo&force=true"
	doRequest(t, ctx, client, cfg, http.MethodPatch, endpoint, resource.YAML,
		"application/apply-patch+yaml", http.StatusOK, http.StatusCreated)
}

func fixtureAPIPath(t *testing.T, resource fixtureResource) string {
	t.Helper()
	name := url.PathEscape(resource.Metadata.Name)
	namespace := url.PathEscape(resource.Metadata.Namespace)
	switch resource.Kind {
	case "Namespace":
		return "/api/v1/namespaces/" + name
	case "Deployment":
		return "/apis/apps/v1/namespaces/" + namespace + "/deployments/" + name
	case "Service":
		return "/api/v1/namespaces/" + namespace + "/services/" + name
	case "NetworkPolicy":
		return "/apis/networking.k8s.io/v1/namespaces/" + namespace + "/networkpolicies/" + name
	default:
		t.Fatalf("unsupported fixture kind %q", resource.Kind)
		return ""
	}
}

func cloudHubKubernetesURL(cfg demoConfig, apiPath string) string {
	return cfg.cloudHubBaseURL + "/cloudhub/v1/kubernetes/proxy" + apiPath
}

func createOpenClawSession(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig) string {
	t.Helper()
	body := []byte(`{"title":"NetworkPolicy recovery demo"}`)
	response := doRequest(t, ctx, client, cfg, http.MethodPost,
		cfg.cloudHubBaseURL+"/cloudhub/v2/openclaw/sessions", body, "application/json", http.StatusCreated)
	var session struct {
		ID string `json:"id"`
	}
	decodeJSON(t, response, &session)
	if session.ID == "" {
		t.Fatal("OpenClaw session response has no id")
	}
	return session.ID
}

func subscribeOpenClawEvents(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig, sessionID string) *websocket.Conn {
	t.Helper()
	endpoint, err := url.Parse(cfg.cloudHubBaseURL + "/cloudhub/v2/openclaw/events/ws")
	if err != nil {
		t.Fatal(err)
	}
	header, err := openClawRequestHeaders(client, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if endpoint.Scheme == "https" {
		endpoint.Scheme = "wss"
	} else {
		endpoint.Scheme = "ws"
	}
	dialer := *websocket.DefaultDialer
	if cfg.insecureSkipVerify {
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} // #nosec G402 -- explicit local demo opt-in
	}
	ws, response, err := dialer.DialContext(ctx, endpoint.String(), header)
	if err != nil {
		if response != nil {
			t.Fatalf("subscribe to OpenClaw events: HTTP %d", response.StatusCode)
		}
		t.Fatalf("subscribe to OpenClaw events: %v", err)
	}
	if err := ws.WriteJSON(map[string]string{"sessionId": sessionID}); err != nil {
		ws.Close()
		t.Fatalf("subscribe to OpenClaw session: %v", err)
	}
	return ws
}

func sendRepairPrompt(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig, sessionID string) {
	t.Helper()
	idempotencyKey := "network-repair-demo-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	prompt := fmt.Sprintf(
		"Use only the k8s_network MCP tools to repair traffic from Deployment frontend to Service backend in namespace %s; the policy is %s. k8s_network is an already registered MCP server, not a skill: do not read or search for SKILL.md. Call these fully qualified tool names exactly once and in this order: k8s_network__inspect_network_policy_path with {\"namespace\":\"%s\",\"sourceWorkload\":\"frontend\",\"destinationService\":\"backend\"}, then k8s_network__repair_network_policy_port with {\"namespace\":\"%s\",\"sourceWorkload\":\"frontend\",\"destinationService\":\"backend\",\"policyName\":\"%s\",\"expectedCurrentPort\":8081,\"desiredPort\":8080}. Never call an unqualified tool name. Do not describe or simulate a tool call. Do not ask the user to type /approve and do not stop to request approval in prose. The platform will intercept the repair tool call, request approval, and resume it after approval. Do not finish until the repair completes.",
		cfg.namespace, demoPolicyName, cfg.namespace, cfg.namespace, demoPolicyName,
	)
	body, err := json.Marshal(map[string]interface{}{
		"message": prompt, "idempotencyKey": idempotencyKey + ":user",
		"timeoutMs": 90000,
	})
	if err != nil {
		t.Fatal(err)
	}
	doRequest(t, ctx, client, cfg, http.MethodPost,
		cfg.cloudHubBaseURL+"/cloudhub/v2/openclaw/sessions/"+url.PathEscape(sessionID)+"/messages",
		body, "application/json", http.StatusAccepted)
}

func readOpenClawEventUntil(t *testing.T, ctx context.Context, ws *websocket.Conn, accept func(openClawEvent) bool) openClawEvent {
	t.Helper()
	deadline := time.Now().Add(2 * time.Minute)
	if contextDeadline, ok := ctx.Deadline(); ok && contextDeadline.Before(deadline) {
		deadline = contextDeadline
	}
	if err := ws.SetReadDeadline(deadline); err != nil {
		t.Fatal(err)
	}
	for {
		var event openClawEvent
		if err := ws.ReadJSON(&event); err != nil {
			t.Fatalf("read OpenClaw event: %v", err)
		}
		if event.ErrorMessage != "" || strings.EqualFold(event.State, "error") {
			t.Fatalf("OpenClaw turn failed: %s", event.ErrorMessage)
		}
		if event.Activity != nil && event.Activity.Error != "" && strings.Contains(event.Activity.Name, "network_policy") {
			t.Fatalf("OpenClaw activity %q failed: %s", event.Activity.Name, event.Activity.Error)
		}
		if accept(event) {
			return event
		}
	}
}

func resolveApproval(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig, sessionID, approvalID string) {
	t.Helper()
	body := []byte(`{"decision":"allow-once"}`)
	endpoint := cfg.cloudHubBaseURL + "/cloudhub/v2/openclaw/sessions/" + url.PathEscape(sessionID) +
		"/approvals/" + url.PathEscape(approvalID) + "/resolve"
	doRequest(t, ctx, client, cfg, http.MethodPost, endpoint, body, "application/json", http.StatusNoContent)
}

func waitForOpenClawApproval(
	t *testing.T,
	ctx context.Context,
	client *http.Client,
	cfg demoConfig,
	sessionID string,
) demoApproval {
	t.Helper()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		for _, approval := range listOpenClawApprovals(t, ctx, client, cfg, sessionID) {
			if isRepairNetworkPolicyPortTool(approval.ToolName) {
				return approval
			}
		}
		select {
		case <-ctx.Done():
			t.Fatalf("wait for OpenClaw approval: %v", ctx.Err())
		case <-ticker.C:
		}
	}
}

func listOpenClawApprovals(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig, sessionID string) []demoApproval {
	t.Helper()
	endpoint := cfg.cloudHubBaseURL + "/cloudhub/v2/openclaw/sessions/" + url.PathEscape(sessionID) + "/approvals"
	body := doRequest(t, ctx, client, cfg, http.MethodGet, endpoint, nil, "", http.StatusOK)
	var response struct {
		Approvals []demoApproval `json:"approvals"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		t.Fatalf("decode OpenClaw approvals: %v", err)
	}
	return response.Approvals
}

func isRepairNetworkPolicyPortTool(toolName string) bool {
	return toolName == "k8s_network__repair_network_policy_port" ||
		toolName == "mcp__k8s_network__repair_network_policy_port"
}

func waitForRepairActivity(t *testing.T, ctx context.Context, ws *websocket.Conn) {
	t.Helper()
	readOpenClawEventUntil(t, ctx, ws, func(event openClawEvent) bool {
		return event.Type == "activity" && event.Activity != nil &&
			event.Activity.Phase == "output" && isRepairNetworkPolicyPortTool(event.Activity.Name)
	})
}

func getLivePolicyPort(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig) int {
	t.Helper()
	apiPath := "/apis/networking.k8s.io/v1/namespaces/" + url.PathEscape(cfg.namespace) +
		"/networkpolicies/" + demoPolicyName
	response := doRequest(t, ctx, client, cfg, http.MethodGet,
		cloudHubKubernetesURL(cfg, apiPath), nil, "", http.StatusOK)
	return policyPortJSON(t, response)
}

func policyPort(t *testing.T, resources []fixtureResource) int {
	t.Helper()
	for _, resource := range resources {
		if resource.Kind == "NetworkPolicy" {
			return policyPortJSON(t, resource.JSON)
		}
	}
	t.Fatal("fixture has no NetworkPolicy")
	return 0
}

func policyPortJSON(t *testing.T, document []byte) int {
	t.Helper()
	var policy struct {
		Spec struct {
			Ingress []struct {
				Ports []struct {
					Port json.RawMessage `json:"port"`
				} `json:"ports"`
			} `json:"ingress"`
		} `json:"spec"`
	}
	decodeJSON(t, document, &policy)
	if len(policy.Spec.Ingress) != 1 || len(policy.Spec.Ingress[0].Ports) != 1 {
		t.Fatal("NetworkPolicy must have exactly one supported ingress port")
	}
	var port int
	if err := json.Unmarshal(policy.Spec.Ingress[0].Ports[0].Port, &port); err != nil {
		t.Fatalf("decode NetworkPolicy port: %v", err)
	}
	return port
}

func waitForFlows(t *testing.T, ctx context.Context, client *http.Client, cfg demoConfig, accept func([]demoFlow) bool) {
	t.Helper()
	query := url.Values{
		"limit":        {"200"},
		"srcNamespace": {cfg.namespace},
		"dstNamespace": {cfg.namespace},
		"srcWorkload":  {"frontend"},
		"dstWorkload":  {"backend"},
	}
	endpoint := cfg.cloudHubBaseURL + "/cloudhub/v1/hubble/clusters/" + url.PathEscape(cfg.hubbleCluster) +
		"/flows/all?" + query.Encode()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		response := doRequest(t, ctx, client, cfg, http.MethodGet, endpoint, nil, "", http.StatusOK)
		var envelope struct {
			Flows []demoFlow `json:"flows"`
		}
		decodeJSON(t, response, &envelope)
		if accept(envelope.Flows) {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatalf("waiting for Hubble flows: %v", ctx.Err())
		case <-ticker.C:
		}
	}
}

func doRequest(
	t *testing.T,
	ctx context.Context,
	client *http.Client,
	cfg demoConfig,
	method string,
	endpoint string,
	body []byte,
	contentType string,
	wantStatus ...int,
) []byte {
	t.Helper()
	request, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Accept", "application/json")
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	if strings.HasPrefix(endpoint, cfg.cloudHubBaseURL) {
		request.Header.Set("Authorization", cfg.authorization)
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("%s %s: %v", method, endpoint, err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024+1))
	if err != nil {
		t.Fatalf("read %s %s response: %v", method, endpoint, err)
	}
	if len(responseBody) > 2*1024*1024 {
		t.Fatalf("%s %s response exceeds 2 MiB", method, endpoint)
	}
	for _, status := range wantStatus {
		if response.StatusCode == status {
			return responseBody
		}
	}
	message := strings.TrimSpace(string(responseBody))
	if len(message) > 512 {
		message = message[:512]
	}
	if message == "" {
		message = http.StatusText(response.StatusCode)
	}
	t.Fatalf("%s %s returned HTTP %d: %s", method, endpoint, response.StatusCode, message)
	return nil
}

func decodeJSON(t *testing.T, document []byte, target interface{}) {
	t.Helper()
	decoder := json.NewDecoder(bytes.NewReader(document))
	if err := decoder.Decode(target); err != nil {
		t.Fatalf("decode JSON response: %v", err)
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
