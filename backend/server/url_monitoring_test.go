package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

const testURLMonitoringTemplate = `
{{ define "main" }}
{{- range .Inputs }}
[[inputs.http_response]]
  interval             = "{{ .Interval }}"
  urls                 = [{{ range $i, $u := .URLs }}{{ if $i }}, {{ end }}"{{ $u }}"{{ end }}]
  response_timeout     = "{{ .ResponseTimeout }}"
  method               = "{{ .Method }}"
  insecure_skip_verify = {{ $.InsecureSkipVerify }}
  [inputs.http_response.tags]
    tenant = "{{ $.OrgName }}"
{{- end }}
[[outputs.influxdb]]
  urls     = ["{{ .InfluxURL }}"]
  database = "{{ .OrgName }}"
  [outputs.influxdb.tagpass]
    tenant = ["{{ .OrgName }}"]
{{ end }}
`

type urlMonitoringStoreStub struct {
	monitoring *cloudhub.URLMonitoring
}

func (s *urlMonitoringStoreStub) All(ctx context.Context) ([]cloudhub.URLMonitoring, error) {
	if s.monitoring == nil {
		return nil, nil
	}
	return []cloudhub.URLMonitoring{*s.monitoring}, nil
}

func (s *urlMonitoringStoreStub) Add(ctx context.Context, m *cloudhub.URLMonitoring) (*cloudhub.URLMonitoring, error) {
	s.monitoring = m
	return m, nil
}

func (s *urlMonitoringStoreStub) Get(ctx context.Context, orgID string) (*cloudhub.URLMonitoring, error) {
	if s.monitoring != nil && s.monitoring.OrgID == orgID {
		return s.monitoring, nil
	}
	return nil, cloudhub.ErrURLMonitoringNotFound
}

func (s *urlMonitoringStoreStub) GetByID(ctx context.Context, id string) (*cloudhub.URLMonitoring, error) {
	if s.monitoring == nil || s.monitoring.ID != id {
		return nil, cloudhub.ErrURLMonitoringNotFound
	}
	cp := *s.monitoring
	cp.Targets = append([]cloudhub.URLMonitoringTarget(nil), s.monitoring.Targets...)
	return &cp, nil
}

func (s *urlMonitoringStoreStub) Update(ctx context.Context, m *cloudhub.URLMonitoring) (*cloudhub.URLMonitoring, error) {
	cp := *m
	cp.Targets = append([]cloudhub.URLMonitoringTarget(nil), m.Targets...)
	s.monitoring = &cp
	return &cp, nil
}

func (s *urlMonitoringStoreStub) Delete(ctx context.Context, id string) error {
	if s.monitoring == nil || s.monitoring.ID != id {
		return cloudhub.ErrURLMonitoringNotFound
	}
	s.monitoring = nil
	return nil
}

func TestGenerateURLMonitoringConf_PerTargetBlocks(t *testing.T) {
	m := &cloudhub.URLMonitoring{
		OrgID: "76",
		Targets: []cloudhub.URLMonitoringTarget{
			{URL: "https://a.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
			{URL: "https://b.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
			{URL: "https://c.com", Interval: "2m", ResponseTimeout: "10s", Method: "POST"},
		},
	}

	conf, err := renderURLMonitoringConf(testURLMonitoringTemplate, m, "http://influxdb:8086", "myorg", true, "", "", "")
	if err != nil {
		t.Fatalf("renderURLMonitoringConf: %v", err)
	}

	// Same-config targets are grouped: a.com+b.com (1m/5s/GET) → 1 block, c.com (2m/10s/POST) → 1 block = 2 total.
	if strings.Count(conf, "[[inputs.http_response]]") != 2 {
		t.Errorf("expected 2 input blocks (grouped by config), got conf:\n%s", conf)
	}
	// Both grouped URLs must appear in the same block.
	if !strings.Contains(conf, `"https://a.com"`) || !strings.Contains(conf, `"https://b.com"`) {
		t.Errorf("expected a.com and b.com in conf:\n%s", conf)
	}

	if !strings.Contains(conf, `[[outputs.influxdb]]`) {
		t.Errorf("missing outputs.influxdb block")
	}
	if !strings.Contains(conf, `database = "myorg"`) {
		t.Errorf("missing database name")
	}
	if !strings.Contains(conf, `tenant = ["myorg"]`) {
		t.Errorf("missing tagpass tenant")
	}
	if !strings.Contains(conf, `tenant = "myorg"`) {
		t.Errorf("missing input tenant tag")
	}
	if !strings.Contains(conf, `method               = "POST"`) {
		t.Errorf("missing per-target method POST")
	}
	if !strings.Contains(conf, `response_timeout     = "10s"`) {
		t.Errorf("missing per-target response_timeout 10s")
	}
}

func TestGenerateURLMonitoringConf_NoTargets(t *testing.T) {
	m := &cloudhub.URLMonitoring{
		OrgID:   "org-empty",
		Targets: []cloudhub.URLMonitoringTarget{},
	}
	conf, err := renderURLMonitoringConf(testURLMonitoringTemplate, m, "http://influxdb:8086", "org-empty", false, "", "", "")
	if err != nil {
		t.Fatalf("renderURLMonitoringConf: %v", err)
	}

	if strings.Contains(conf, "[[inputs.http_response]]") {
		t.Errorf("expected no input blocks when no targets")
	}
}

func TestApplyURLMonitoringToCollector_NoTargets_RemovesConfAndRestarts(t *testing.T) {
	ctx := context.Background()

	var deployCalled bool
	var removeCalled bool
	var restartCalled bool

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error {
			return nil
		},
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			deployCalled = true
			return nil
		},
		RemoveTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string) error {
			removeCalled = true
			expected := fmt.Sprintf("url-monitoring/%s.conf", "org-1")
			if configName != expected {
				t.Fatalf("RemoveTelegrafConfig configName=%q want %q", configName, expected)
			}
			if collectorName != "collector-1" {
				t.Fatalf("RemoveTelegrafConfig collectorName=%q want %q", collectorName, "collector-1")
			}
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error {
			restartCalled = true
			return nil
		},
	}

	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform: platform,
		},
		Logger: mocks.NewLogger(),
	}

	// no targets => remove conf
	err := s.applyURLMonitoringToCollector(ctx, &cloudhub.URLMonitoring{
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets:         []cloudhub.URLMonitoringTarget{},
	})
	if err != nil {
		t.Fatalf("applyURLMonitoringToCollector: %v", err)
	}
	if deployCalled {
		t.Fatal("DeployTelegrafConfig should not be called when no targets")
	}
	if !removeCalled {
		t.Fatal("RemoveTelegrafConfig should be called when no targets")
	}
	if !restartCalled {
		t.Fatal("RestartTelegraf should be called when no targets")
	}
}

func TestApplyURLMonitoringToCollector_EnabledTargets_DeploysAndRestarts(t *testing.T) {
	ctx := context.Background()

	var deployCalled bool
	var deployConfigName string
	var deployContent string

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error {
			return nil
		},
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			deployCalled = true
			deployConfigName = configName
			deployContent = content
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error {
			return nil
		},
	}

	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
	}

	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:         platform,
			TemplatesManager: templatesManager,
		},
		Logger: mocks.NewLogger(),
	}

	err := s.applyURLMonitoringToCollector(ctx, &cloudhub.URLMonitoring{
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{URL: "https://a.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	})
	if err != nil {
		t.Fatalf("applyURLMonitoringToCollector: %v", err)
	}
	if !deployCalled {
		t.Fatal("DeployTelegrafConfig should be called when enabled targets exist")
	}
	if deployConfigName != "url-monitoring/org-1.conf" {
		t.Fatalf("deployConfigName=%q want %q", deployConfigName, "url-monitoring/org-1.conf")
	}
	if !strings.Contains(deployContent, `interval             = "1m"`) {
		t.Fatalf("deployContent should contain interval, got:\n%s", deployContent)
	}
	if !strings.Contains(deployContent, `database = "myorg"`) {
		t.Fatalf("deployContent should contain database myorg, got:\n%s", deployContent)
	}
}

func TestRemoveURLMonitoringFromCollector_RemovesConfAndRestarts(t *testing.T) {
	ctx := context.Background()

	var removeCalled bool
	var restartCalled bool

	platform := &mocks.MockPlatform{
		RemoveTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string) error {
			removeCalled = true
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error {
			restartCalled = true
			return nil
		},
	}

	s := &Service{
		InternalENV: cloudhub.InternalEnvironment{
			Platform: platform,
		},
		Logger: mocks.NewLogger(),
	}

	err := s.removeURLMonitoringFromCollector(ctx, &cloudhub.URLMonitoring{
		OrgID:           "org-1",
		CollectorServer: "collector-1",
	})
	if err != nil {
		t.Fatalf("removeURLMonitoringFromCollector: %v", err)
	}
	if !removeCalled {
		t.Fatal("RemoveTelegrafConfig should be called")
	}
	if !restartCalled {
		t.Fatal("RestartTelegraf should be called")
	}
}

func TestAddURLMonitoringTarget_DuplicateName_ReturnsConflict(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")

	var deployCalled bool

	initial := &cloudhub.URLMonitoring{
		ID:              "um-1",
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Foo", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}

	stub := &urlMonitoringStoreStub{monitoring: initial}
	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
		URLMonitoringStore: stub,
	}

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			deployCalled = true
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}

	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.POST("/cloudhub/v1/url-monitoring-targets", s.AddURLMonitoringTarget)

	body := `{"name":"foo","url":"https://new.com","interval":"2m"}`
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/url-monitoring-targets", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
	if deployCalled {
		t.Fatal("DeployTelegrafConfig should not be called on duplicate name")
	}
	if stub.monitoring.Targets[0].URL != "https://old.com" {
		t.Fatalf("expected existing target to remain unchanged, got %+v", stub.monitoring.Targets[0])
	}
}

func TestAddURLMonitoringTarget_UpsertsByName_InsertIfMissing(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")

	initial := &cloudhub.URLMonitoring{
		ID:              "um-1",
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Foo", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}

	var deployContent string

	stub := &urlMonitoringStoreStub{monitoring: initial}
	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
		URLMonitoringStore: stub,
	}

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			deployContent = content
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}

	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.POST("/cloudhub/v1/url-monitoring-targets", s.AddURLMonitoringTarget)

	body := `{"name":"Bar","url":"https://new.com","interval":"1m"}`
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/url-monitoring-targets", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	// Should now have 2 targets.
	if len(stub.monitoring.Targets) != 2 {
		t.Fatalf("expected 2 targets after insert, got %d", len(stub.monitoring.Targets))
	}
	if !strings.Contains(deployContent, `https://old.com`) || !strings.Contains(deployContent, `https://new.com`) {
		t.Fatalf("deployContent should contain both urls, got:\n%s", deployContent)
	}
}

func TestAddURLMonitoringTarget_TrimsURLBeforePersist(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")

	initial := &cloudhub.URLMonitoring{
		ID:              "um-1",
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Foo", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}

	stub := &urlMonitoringStoreStub{monitoring: initial}
	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
		URLMonitoringStore: stub,
	}

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}

	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.POST("/cloudhub/v1/url-monitoring-targets", s.AddURLMonitoringTarget)

	body := `{"name":"Bar","url":"   https://new.com/health   ","interval":"1m"}`
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/url-monitoring-targets", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	if got := stub.monitoring.Targets[1].URL; got != "https://new.com/health" {
		t.Fatalf("expected trimmed url, got %q", got)
	}
}

func TestAddURLMonitoringTarget_URLWithNewline_ReturnsBadRequest(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")

	initial := &cloudhub.URLMonitoring{
		ID:              "um-1",
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Foo", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}

	var deployCalled bool
	stub := &urlMonitoringStoreStub{monitoring: initial}
	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
		URLMonitoringStore: stub,
	}

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			deployCalled = true
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}

	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.POST("/cloudhub/v1/url-monitoring-targets", s.AddURLMonitoringTarget)

	body := "{\"name\":\"Bar\",\"url\":\"https://new.com\\nBAD\",\"interval\":\"1m\"}"
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/url-monitoring-targets", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d body=%s", rr.Code, rr.Body.String())
	}
	if deployCalled {
		t.Fatal("DeployTelegrafConfig should not be called when url is invalid")
	}
}

func TestAddURLMonitoringTarget_AutoCreatesParent(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-new")

	stub := &urlMonitoringStoreStub{} // no existing monitoring
	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				return &cloudhub.Organization{ID: "org-new", Name: "neworg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
		URLMonitoringStore: stub,
	}

	platform := &mocks.MockPlatform{
		GetActiveCollectorsFunc: func(ctx context.Context) ([]string, map[string]bool, error) {
			return []string{"collector-1"}, nil, nil
		},
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}

	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.POST("/cloudhub/v1/url-monitoring-targets", s.AddURLMonitoringTarget)

	body := `{"name":"svc","url":"https://svc.example.com","interval":"1m"}`
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/url-monitoring-targets", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	var resp urlMonitoringResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.OrgID != "org-new" {
		t.Errorf("expected orgId org-new, got %q", resp.OrgID)
	}
	if len(resp.Targets) != 1 || resp.Targets[0].Name != "svc" {
		t.Errorf("unexpected targets: %+v", resp.Targets)
	}
}

func TestDeleteURLMonitoringTarget_DeletesAndApplies(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")

	initial := &cloudhub.URLMonitoring{
		ID:              "um-1",
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Foo", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
			{ID: "t2", Name: "Baz", URL: "https://baz.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}

	stub := &urlMonitoringStoreStub{monitoring: initial}
	store := &mocks.Store{
		URLMonitoringStore: stub,
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
	}

	var deployCalled bool
	var removeCalled bool

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			deployCalled = true
			return nil
		},
		RemoveTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string) error {
			removeCalled = true
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}

	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.DELETE("/cloudhub/v1/url-monitoring-targets/:targetId", s.DeleteURLMonitoringTarget)

	req := httptest.NewRequest(http.MethodDelete, "/cloudhub/v1/url-monitoring-targets/t1", nil)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	// t1 should be removed, t2 remains.
	if len(stub.monitoring.Targets) != 1 || stub.monitoring.Targets[0].ID != "t2" {
		t.Fatalf("expected only t2 remaining, got %+v", stub.monitoring.Targets)
	}
	// Since still has enabled targets, deploy should be called (not remove).
	if !deployCalled {
		t.Fatal("expected DeployTelegrafConfig after delete when enabled targets remain")
	}
	if removeCalled {
		t.Fatal("expected RemoveTelegrafConfig not to be called when enabled targets remain")
	}
}

func TestPatchURLMonitoringTarget_UpdatesByID(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")

	initial := &cloudhub.URLMonitoring{
		ID:              "um-1",
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Foo", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}
	stub := &urlMonitoringStoreStub{monitoring: initial}

	store := &mocks.Store{
		URLMonitoringStore: stub,
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
	}

	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}
	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.PATCH("/cloudhub/v1/url-monitoring-targets/:targetId", s.PatchURLMonitoringTarget)

	body := `{"name":"Foo2","url":"https://new.com","interval":"2m","responseTimeout":"10s","method":"POST"}`
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v1/url-monitoring-targets/t1", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	if len(stub.monitoring.Targets) != 1 {
		t.Fatalf("expected 1 target, got %d", len(stub.monitoring.Targets))
	}
	got := stub.monitoring.Targets[0]
	if got.ID != "t1" || got.Name != "Foo2" || got.URL != "https://new.com" || got.Interval != "2m" {
		t.Fatalf("unexpected updated target: %+v", got)
	}
	if got.ResponseTimeout != "10s" || got.Method != "POST" {
		t.Fatalf("expected responseTimeout=10s method=POST, got timeout=%q method=%q", got.ResponseTimeout, got.Method)
	}
}

func TestPatchURLMonitoringTarget_DuplicateNameOnOtherTarget_ReturnsConflict(t *testing.T) {
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")

	initial := &cloudhub.URLMonitoring{
		ID:              "um-1",
		OrgID:           "org-1",
		CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Alpha", URL: "https://alpha.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
			{ID: "t2", Name: "Beta", URL: "https://beta.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}
	stub := &urlMonitoringStoreStub{monitoring: initial}

	store := &mocks.Store{
		URLMonitoringStore: stub,
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
	}

	var deployCalled bool
	platform := &mocks.MockPlatform{
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName string, configName string, content string) error {
			deployCalled = true
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}
	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}

	s := &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}

	router := httprouter.New()
	router.PATCH("/cloudhub/v1/url-monitoring-targets/:targetId", s.PatchURLMonitoringTarget)

	// t1 이름을 다른 target(t2)의 이름 "Beta"로 변경 시도 -> conflict
	body := `{"name":"beta","url":"https://alpha-new.com","interval":"2m","responseTimeout":"10s","method":"POST"}`
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v1/url-monitoring-targets/t1", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
	if deployCalled {
		t.Fatal("DeployTelegrafConfig should not be called on duplicate name conflict")
	}
	if stub.monitoring.Targets[0].Name != "Alpha" {
		t.Fatalf("expected target to remain unchanged, got %+v", stub.monitoring.Targets[0])
	}
}

// ─── BulkAddURLMonitoringTargets tests ────────────────────────────────────

// newBulkService returns a Service wired with the given stub and a real-enough
// platform for BulkAddURLMonitoringTargets tests.
func newBulkService(t *testing.T, stub *urlMonitoringStoreStub, hasParent bool) *Service {
	t.Helper()
	store := &mocks.Store{
		OrganizationsStore: &mocks.OrganizationsStore{
			GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
				id := "org-1"
				if q.ID != nil {
					id = *q.ID
				}
				return &cloudhub.Organization{ID: id, Name: "myorg"}, nil
			},
		},
		SourcesStore: &mocks.SourcesStore{
			AllF: func(ctx context.Context) ([]cloudhub.Source, error) {
				return []cloudhub.Source{{ID: 1, URL: "http://influx:8086"}}, nil
			},
		},
		URLMonitoringStore: stub,
	}
	platform := &mocks.MockPlatform{
		GetActiveCollectorsFunc: func(ctx context.Context) ([]string, map[string]bool, error) {
			return []string{"collector-1"}, nil, nil
		},
		VerifyCollectorReadyFunc: func(ctx context.Context, collectorName string) error { return nil },
		DeployTelegrafConfigFunc: func(ctx context.Context, collectorName, configName, content string) error {
			return nil
		},
		RestartTelegrafFunc: func(ctx context.Context, collectorName string) error { return nil },
	}
	templatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{Template: testURLMonitoringTemplate}, nil
		},
	}
	return &Service{
		Store: store,
		InternalENV: cloudhub.InternalEnvironment{
			Platform:            platform,
			TemplatesManager:    templatesManager,
			URLMonitoringConfig: cloudhub.URLMonitoringConfig{TelegrafPath: "/etc/telegraf"},
		},
		Logger: mocks.NewLogger(),
	}
}

func doBulkRequest(t *testing.T, svc *Service, body string) *httptest.ResponseRecorder {
	t.Helper()
	ctx := context.WithValue(context.Background(), organizations.ContextKey, "org-1")
	router := httprouter.New()
	router.POST("/cloudhub/v1/url-monitoring-targets/bulk", svc.BulkAddURLMonitoringTargets)
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/url-monitoring-targets/bulk", bytes.NewBufferString(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	return rr
}

func TestBulkAddURLMonitoringTargets_AllSuccess(t *testing.T) {
	stub := &urlMonitoringStoreStub{monitoring: &cloudhub.URLMonitoring{
		ID: "um-1", OrgID: "org-1", CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{},
	}}
	svc := newBulkService(t, stub, true)

	body := `{"targets":[
		{"name":"A","url":"https://a.com","interval":"1m"},
		{"name":"B","url":"https://b.com","interval":"5m"}
	]}`
	rr := doBulkRequest(t, svc, body)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp struct {
		Succeeded []string `json:"succeeded"`
		Failed    []struct {
			Name  string `json:"name"`
			Error string `json:"error"`
		} `json:"failed"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Succeeded) != 2 {
		t.Fatalf("expected 2 succeeded, got %d", len(resp.Succeeded))
	}
	if len(resp.Failed) != 0 {
		t.Fatalf("expected 0 failed, got %d", len(resp.Failed))
	}
	if len(stub.monitoring.Targets) != 2 {
		t.Fatalf("expected 2 targets in store, got %d", len(stub.monitoring.Targets))
	}
}

func TestBulkAddURLMonitoringTargets_PartialFailure(t *testing.T) {
	stub := &urlMonitoringStoreStub{monitoring: &cloudhub.URLMonitoring{
		ID: "um-1", OrgID: "org-1", CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{},
	}}
	svc := newBulkService(t, stub, true)

	// 유효 2개 + url 누락 1개
	body := `{"targets":[
		{"name":"A","url":"https://a.com","interval":"1m"},
		{"name":"B","url":"https://b.com","interval":"5m"},
		{"name":"C","url":""}
	]}`
	rr := doBulkRequest(t, svc, body)

	if rr.Code != http.StatusMultiStatus {
		t.Fatalf("expected 207, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp struct {
		Succeeded []string `json:"succeeded"`
		Failed    []struct {
			Name  string `json:"name"`
			Error string `json:"error"`
		} `json:"failed"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Succeeded) != 2 {
		t.Fatalf("expected 2 succeeded, got %d: %v", len(resp.Succeeded), resp.Succeeded)
	}
	if len(resp.Failed) != 1 {
		t.Fatalf("expected 1 failed, got %d", len(resp.Failed))
	}
	if resp.Failed[0].Name != "C" {
		t.Fatalf("expected failed name=C, got %q", resp.Failed[0].Name)
	}
	if len(stub.monitoring.Targets) != 2 {
		t.Fatalf("expected 2 targets saved, got %d", len(stub.monitoring.Targets))
	}
}

func TestBulkAddURLMonitoringTargets_AllFail_Returns400(t *testing.T) {
	stub := &urlMonitoringStoreStub{monitoring: &cloudhub.URLMonitoring{
		ID: "um-1", OrgID: "org-1", CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{},
	}}
	svc := newBulkService(t, stub, true)

	body := `{"targets":[
		{"name":"","url":""},
		{"name":"B","url":""}
	]}`
	rr := doBulkRequest(t, svc, body)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestBulkAddURLMonitoringTargets_EmptyTargets_Returns400(t *testing.T) {
	stub := &urlMonitoringStoreStub{monitoring: &cloudhub.URLMonitoring{
		ID: "um-1", OrgID: "org-1", CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{},
	}}
	svc := newBulkService(t, stub, true)

	rr := doBulkRequest(t, svc, `{"targets":[]}`)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestBulkAddURLMonitoringTargets_UpsertByName(t *testing.T) {
	// 기존 target "Foo" 가 있고, bulk에 "foo"(소문자) 로 업데이트 시도
	stub := &urlMonitoringStoreStub{monitoring: &cloudhub.URLMonitoring{
		ID: "um-1", OrgID: "org-1", CollectorServer: "collector-1",
		Targets: []cloudhub.URLMonitoringTarget{
			{ID: "t1", Name: "Foo", URL: "https://old.com", Interval: "1m", ResponseTimeout: "5s", Method: "GET"},
		},
	}}
	svc := newBulkService(t, stub, true)

	body := `{"targets":[{"name":"foo","url":"https://new.com","interval":"2m"}]}`
	rr := doBulkRequest(t, svc, body)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	// target 수는 그대로 1개 (upsert, not insert)
	if len(stub.monitoring.Targets) != 1 {
		t.Fatalf("expected 1 target (upserted), got %d", len(stub.monitoring.Targets))
	}
	if stub.monitoring.Targets[0].URL != "https://new.com" {
		t.Fatalf("expected url updated, got %q", stub.monitoring.Targets[0].URL)
	}
	if stub.monitoring.Targets[0].ID != "t1" {
		t.Fatalf("expected original ID preserved, got %q", stub.monitoring.Targets[0].ID)
	}
}
