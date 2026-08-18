package repair

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/cloudhubproxy"
)

const (
	deploymentPath = "/apis/apps/v1/namespaces/network-repair-demo/deployments/frontend"
	sourcePodsPath = "/api/v1/namespaces/network-repair-demo/pods?labelSelector=app%3Dfrontend"
	servicePath    = "/api/v1/namespaces/network-repair-demo/services/backend"
	endpointPath   = "/apis/discovery.k8s.io/v1/namespaces/network-repair-demo/endpointslices?labelSelector=kubernetes.io%2Fservice-name%3Dbackend"
	destPodsPath   = "/api/v1/namespaces/network-repair-demo/pods?labelSelector=app%3Dbackend"
	policiesPath   = "/apis/networking.k8s.io/v1/namespaces/network-repair-demo/networkpolicies"
	policyPath     = "/apis/networking.k8s.io/v1/namespaces/network-repair-demo/networkpolicies/allow-frontend-to-backend"
)

type proxyRequest struct {
	method      string
	path        string
	body        []byte
	contentType string
}

type fixtureProxy struct {
	responses         map[string][]byte
	responseSequences map[string][][]byte
	errors            map[string]error
	requests          []proxyRequest
}

func (p *fixtureProxy) Do(
	ctx context.Context,
	method string,
	path string,
	body []byte,
	contentType string,
) ([]byte, error) {
	p.requests = append(p.requests, proxyRequest{
		method:      method,
		path:        path,
		body:        append([]byte(nil), body...),
		contentType: contentType,
	})
	key := method + " " + path
	if err := p.errors[key]; err != nil {
		return nil, err
	}
	if sequence := p.responseSequences[key]; len(sequence) > 0 {
		response := sequence[0]
		p.responseSequences[key] = sequence[1:]
		return append([]byte(nil), response...), nil
	}
	response, ok := p.responses[key]
	if !ok {
		return nil, errors.New("unexpected proxy request: " + key)
	}
	return append([]byte(nil), response...), nil
}

func newInspectionFixture() *fixtureProxy {
	return &fixtureProxy{
		responses: map[string][]byte{
			http.MethodGet + " " + deploymentPath: []byte(`{
				"apiVersion":"apps/v1","kind":"Deployment",
				"metadata":{"name":"frontend","namespace":"network-repair-demo","resourceVersion":"rv-deploy-1"},
				"spec":{"selector":{"matchLabels":{"app":"frontend"}}}
			}`),
			http.MethodGet + " " + sourcePodsPath: []byte(`{
				"apiVersion":"v1","kind":"PodList","items":[
					{"apiVersion":"v1","kind":"Pod","metadata":{"name":"frontend-1","namespace":"network-repair-demo","labels":{"app":"frontend"}},"status":{"podIP":"10.0.0.7"}}
				]
			}`),
			http.MethodGet + " " + servicePath: []byte(`{
				"apiVersion":"v1","kind":"Service",
				"metadata":{"name":"backend","namespace":"network-repair-demo","resourceVersion":"rv-service-1"},
				"spec":{"selector":{"app":"backend"},"ports":[{"name":"http","protocol":"TCP","port":8080,"targetPort":8080}]}
			}`),
			http.MethodGet + " " + endpointPath: []byte(`{
				"apiVersion":"discovery.k8s.io/v1","kind":"EndpointSliceList","items":[{
					"metadata":{"name":"backend-abc","namespace":"network-repair-demo","labels":{"kubernetes.io/service-name":"backend"}},
					"ports":[{"name":"http","protocol":"TCP","port":8080}],
					"endpoints":[{"addresses":["10.0.0.8"],"conditions":{"ready":true},"targetRef":{"kind":"Pod","namespace":"network-repair-demo","name":"backend-1"}}]
				}]
			}`),
			http.MethodGet + " " + destPodsPath: []byte(`{
				"apiVersion":"v1","kind":"PodList","items":[
					{"apiVersion":"v1","kind":"Pod","metadata":{"name":"backend-1","namespace":"network-repair-demo","labels":{"app":"backend"}},"status":{"podIP":"10.0.0.8"}}
				]
			}`),
			http.MethodGet + " " + policiesPath: []byte(`{
				"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicyList","items":[{
					"metadata":{"name":"allow-frontend-to-backend","namespace":"network-repair-demo","resourceVersion":"rv-policy-1"},
					"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"policyTypes":["Ingress"],"ingress":[{
						"from":[{"podSelector":{"matchLabels":{"app":"frontend"}}}],
						"ports":[{"protocol":"TCP","port":8081}]
					}]}
				}]
			}`),
			http.MethodGet + " " + policyPath: []byte(`{
				"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy",
				"metadata":{"name":"allow-frontend-to-backend","namespace":"network-repair-demo","resourceVersion":"rv-policy-1"},
				"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"policyTypes":["Ingress"],"ingress":[{
					"from":[{"podSelector":{"matchLabels":{"app":"frontend"}}}],
					"ports":[{"protocol":"TCP","port":8081}]
				}]}
			}`),
		},
		responseSequences: make(map[string][][]byte),
		errors:            make(map[string]error),
	}
}

func wrongPolicyJSON() []byte {
	return []byte(`{
		"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy",
		"metadata":{"name":"allow-frontend-to-backend","namespace":"network-repair-demo","resourceVersion":"rv-policy-1"},
		"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"policyTypes":["Ingress"],"ingress":[{
			"from":[{"podSelector":{"matchLabels":{"app":"frontend"}}}],
			"ports":[{"protocol":"TCP","port":8081}]
		}]}
	}`)
}

func fixedPolicyJSON() []byte {
	return []byte(`{
		"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy",
		"metadata":{"name":"allow-frontend-to-backend","namespace":"network-repair-demo","resourceVersion":"rv-policy-2"},
		"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"policyTypes":["Ingress"],"ingress":[{
			"from":[{"podSelector":{"matchLabels":{"app":"frontend"}}}],
			"ports":[{"protocol":"TCP","port":8080}]
		}]}
	}`)
}

func changedPolicyJSON() []byte {
	return []byte(strings.ReplaceAll(string(wrongPolicyJSON()), "8081", "9090"))
}

func countRequests(requests []proxyRequest, method string) int {
	count := 0
	for _, request := range requests {
		if request.method == method {
			count++
		}
	}
	return count
}

func newTestService(proxy *fixtureProxy, now func() time.Time) (*Service, *PlanStore) {
	store := NewPlanStore(2*time.Minute, now)
	return NewService(proxy, "network-repair-demo", store), store
}

func TestInspectFindsNetworkPolicyPortMismatchUsingOnlyGET(t *testing.T) {
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, time.Now)

	got, err := service.Inspect(context.Background(), InspectInput{
		Namespace:          "network-repair-demo",
		SourceWorkload:     "frontend",
		DestinationService: "backend",
	})
	if err != nil {
		t.Fatal(err)
	}

	if got.Namespace != "network-repair-demo" || got.SourceWorkload != "frontend" || got.DestinationService != "backend" {
		t.Fatalf("identity fields = %#v", got)
	}
	if got.ServiceTargetPort != 8080 {
		t.Errorf("ServiceTargetPort = %d, want 8080", got.ServiceTargetPort)
	}
	if len(got.Policies) != 1 {
		t.Fatalf("Policies = %#v", got.Policies)
	}
	if got.Policies[0] != (PolicyCandidate{
		Name:            "allow-frontend-to-backend",
		CurrentPort:     8081,
		ResourceVersion: "rv-policy-1",
	}) {
		t.Errorf("policy = %#v", got.Policies[0])
	}
	for _, request := range proxy.requests {
		if request.method != http.MethodGet {
			t.Errorf("inspection sent %s %s", request.method, request.path)
		}
	}
}

func TestInspectRejectsWrongNamespaceBeforeProxyAccess(t *testing.T) {
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, time.Now)

	_, err := service.Inspect(context.Background(), InspectInput{
		Namespace:          "production",
		SourceWorkload:     "frontend",
		DestinationService: "backend",
	})
	if ErrorCodeOf(err) != ErrorNotAllowed {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
	if len(proxy.requests) != 0 {
		t.Fatalf("wrong namespace made %d proxy requests", len(proxy.requests))
	}
}

func TestInspectRejectsAmbiguousServiceTargets(t *testing.T) {
	tests := []struct {
		name         string
		serviceJSON  string
		endpointJSON string
	}{
		{
			name: "multiple service ports",
			serviceJSON: `{"apiVersion":"v1","kind":"Service","metadata":{"name":"backend","namespace":"network-repair-demo"},"spec":{"selector":{"app":"backend"},"ports":[
				{"name":"http","protocol":"TCP","port":8080,"targetPort":8080},
				{"name":"metrics","protocol":"TCP","port":9090,"targetPort":9090}
			]}}`,
		},
		{
			name: "inconsistent named target port",
			serviceJSON: `{"apiVersion":"v1","kind":"Service","metadata":{"name":"backend","namespace":"network-repair-demo"},"spec":{"selector":{"app":"backend"},"ports":[
				{"name":"http","protocol":"TCP","port":80,"targetPort":"backend-http"}
			]}}`,
			endpointJSON: `{"apiVersion":"discovery.k8s.io/v1","kind":"EndpointSliceList","items":[
				{"metadata":{"name":"backend-a"},"ports":[{"name":"backend-http","protocol":"TCP","port":8080}],"endpoints":[{"addresses":["10.0.0.8"],"targetRef":{"kind":"Pod","name":"backend-1"}}]},
				{"metadata":{"name":"backend-b"},"ports":[{"name":"backend-http","protocol":"TCP","port":9090}],"endpoints":[{"addresses":["10.0.0.9"],"targetRef":{"kind":"Pod","name":"backend-2"}}]}
			]}`,
		},
		{
			name: "empty endpoints",
			endpointJSON: `{"apiVersion":"discovery.k8s.io/v1","kind":"EndpointSliceList","items":[
				{"metadata":{"name":"backend-a"},"ports":[{"name":"http","protocol":"TCP","port":8080}],"endpoints":[]}
			]}`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			proxy := newInspectionFixture()
			if test.serviceJSON != "" {
				proxy.responses[http.MethodGet+" "+servicePath] = []byte(test.serviceJSON)
			}
			if test.endpointJSON != "" {
				proxy.responses[http.MethodGet+" "+endpointPath] = []byte(test.endpointJSON)
			}
			service, _ := newTestService(proxy, time.Now)

			_, err := service.Inspect(context.Background(), InspectInput{
				Namespace:          "network-repair-demo",
				SourceWorkload:     "frontend",
				DestinationService: "backend",
			})
			if ErrorCodeOf(err) != ErrorAmbiguousTarget {
				t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
			}
			for _, request := range proxy.requests {
				if request.method != http.MethodGet {
					t.Errorf("inspection sent %s %s", request.method, request.path)
				}
			}
		})
	}
}

func TestInspectReturnsNotFoundWhenNoPolicySelectsPath(t *testing.T) {
	proxy := newInspectionFixture()
	proxy.responses[http.MethodGet+" "+policiesPath] = []byte(`{
		"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicyList","items":[{
			"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy",
			"metadata":{"name":"other","namespace":"network-repair-demo","resourceVersion":"rv-other"},
			"spec":{"podSelector":{"matchLabels":{"app":"other"}},"ingress":[{"ports":[{"protocol":"TCP","port":8081}]}]}
		}]
	}`)
	service, _ := newTestService(proxy, time.Now)

	_, err := service.Inspect(context.Background(), InspectInput{
		Namespace:          "network-repair-demo",
		SourceWorkload:     "frontend",
		DestinationService: "backend",
	})
	if ErrorCodeOf(err) != ErrorNotFound {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
}

func TestPlanCreatesTwoMinuteReadOnlyRepairPlan(t *testing.T) {
	now := time.Date(2026, 8, 14, 3, 0, 0, 0, time.UTC)
	proxy := newInspectionFixture()
	service, store := newTestService(proxy, func() time.Time { return now })

	got, err := service.Plan(context.Background(), PlanInput{
		Namespace:          "network-repair-demo",
		PolicyName:         "allow-frontend-to-backend",
		DestinationService: "backend",
	})
	if err != nil {
		t.Fatal(err)
	}

	if !regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(got.PlanID) {
		t.Errorf("PlanID = %q, want UUID v4", got.PlanID)
	}
	if got.Namespace != "network-repair-demo" || got.PolicyName != "allow-frontend-to-backend" {
		t.Fatalf("identity fields = %#v", got)
	}
	if got.CurrentPort != 8081 || got.DesiredPort != 8080 || got.ResourceVersion != "rv-policy-1" {
		t.Fatalf("plan state = %#v", got)
	}
	if got.Diff != "spec.ingress[0].ports[0].port: 8081 -> 8080" {
		t.Errorf("Diff = %q", got.Diff)
	}
	if !got.ExpiresAt.Equal(now.Add(2 * time.Minute)) {
		t.Errorf("ExpiresAt = %s", got.ExpiresAt)
	}
	stored, err := store.Get(got.PlanID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.ResourceVersion != "rv-policy-1" || stored.DesiredPort != 8080 {
		t.Fatalf("stored plan = %#v", stored)
	}
	for _, request := range proxy.requests {
		if request.method != http.MethodGet {
			t.Errorf("planning sent %s %s", request.method, request.path)
		}
	}
}

func TestPlanReturnsNoChangeWithoutCreatingPlan(t *testing.T) {
	proxy := newInspectionFixture()
	proxy.responses[http.MethodGet+" "+policyPath] = []byte(`{
		"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy",
		"metadata":{"name":"allow-frontend-to-backend","namespace":"network-repair-demo","resourceVersion":"rv-policy-2"},
		"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"ingress":[{"ports":[{"protocol":"TCP","port":8080}]}]}
	}`)
	service, store := newTestService(proxy, time.Now)

	got, err := service.Plan(context.Background(), PlanInput{
		Namespace:          "network-repair-demo",
		PolicyName:         "allow-frontend-to-backend",
		DestinationService: "backend",
	})
	if ErrorCodeOf(err) != ErrorNoChange {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
	if got.PlanID != "" {
		t.Fatalf("PlanID = %q", got.PlanID)
	}
	if len(store.plans) != 0 {
		t.Fatalf("no-change created %d plans", len(store.plans))
	}
}

func TestApplySendsBoundedJSONPatchAndVerifiesLivePolicy(t *testing.T) {
	now := time.Date(2026, 8, 14, 3, 0, 0, 0, time.UTC)
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, func() time.Time { return now })
	plan, err := service.Plan(context.Background(), PlanInput{
		Namespace:          "network-repair-demo",
		PolicyName:         "allow-frontend-to-backend",
		DestinationService: "backend",
	})
	if err != nil {
		t.Fatal(err)
	}
	proxy.responseSequences[http.MethodGet+" "+policyPath] = [][]byte{
		wrongPolicyJSON(),
		fixedPolicyJSON(),
		fixedPolicyJSON(),
	}
	proxy.responses[http.MethodPatch+" "+policyPath] = fixedPolicyJSON()

	input := ApplyInput{
		PlanID:         plan.PlanID,
		Namespace:      plan.Namespace,
		PolicyName:     plan.PolicyName,
		CurrentPort:    plan.CurrentPort,
		DesiredPort:    plan.DesiredPort,
		IdempotencyKey: "demo-repair-001",
	}
	got, err := service.Apply(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if got != (ApplyResult{
		PlanID:          plan.PlanID,
		Namespace:       "network-repair-demo",
		PolicyName:      "allow-frontend-to-backend",
		PreviousPort:    8081,
		CurrentPort:     8080,
		ResourceVersion: "rv-policy-2",
	}) {
		t.Fatalf("Apply() = %#v", got)
	}

	const expectedPatch = `[{"op":"test","path":"/metadata/resourceVersion","value":"rv-policy-1"},{"op":"test","path":"/spec/ingress/0/ports/0/port","value":8081},{"op":"replace","path":"/spec/ingress/0/ports/0/port","value":8080}]`
	var patchRequest *proxyRequest
	for i := range proxy.requests {
		if proxy.requests[i].method == http.MethodPatch {
			patchRequest = &proxy.requests[i]
		}
	}
	if patchRequest == nil {
		t.Fatal("Apply() sent no PATCH")
	}
	if patchRequest.path != policyPath {
		t.Errorf("PATCH path = %q", patchRequest.path)
	}
	if patchRequest.contentType != "application/json-patch+json" {
		t.Errorf("PATCH content type = %q", patchRequest.contentType)
	}
	if string(patchRequest.body) != expectedPatch {
		t.Errorf("PATCH body = %s", patchRequest.body)
	}

	requestCount := len(proxy.requests)
	replayed, err := service.Apply(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if replayed != got {
		t.Fatalf("replayed Apply() = %#v, want %#v", replayed, got)
	}
	if len(proxy.requests) != requestCount {
		t.Fatalf("idempotent replay made %d additional requests", len(proxy.requests)-requestCount)
	}

	verified, err := service.Verify(context.Background(), VerifyInput{PlanID: plan.PlanID})
	if err != nil {
		t.Fatal(err)
	}
	if verified != (VerifyResult{PlanID: plan.PlanID, Verified: true, CurrentPort: 8080}) {
		t.Fatalf("Verify() = %#v", verified)
	}
}

func TestApplyRejectsExpiredPlanBeforePATCH(t *testing.T) {
	now := time.Date(2026, 8, 14, 3, 0, 0, 0, time.UTC)
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, func() time.Time { return now })
	plan, err := service.Plan(context.Background(), PlanInput{
		Namespace: "network-repair-demo", PolicyName: "allow-frontend-to-backend", DestinationService: "backend",
	})
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(2 * time.Minute)

	_, err = service.Apply(context.Background(), ApplyInput{
		PlanID: plan.PlanID, Namespace: plan.Namespace, PolicyName: plan.PolicyName,
		CurrentPort: 8081, DesiredPort: 8080, IdempotencyKey: "expired-key",
	})
	if ErrorCodeOf(err) != ErrorPlanExpired {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
	if countRequests(proxy.requests, http.MethodPatch) != 0 {
		t.Fatal("expired plan sent PATCH")
	}
}

func TestApplyRejectsApprovalFieldMismatchBeforePATCH(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*ApplyInput)
	}{
		{name: "wrong namespace", mutate: func(in *ApplyInput) { in.Namespace = "production" }},
		{name: "wrong policy", mutate: func(in *ApplyInput) { in.PolicyName = "other" }},
		{name: "wrong current port", mutate: func(in *ApplyInput) { in.CurrentPort = 9999 }},
		{name: "wrong desired port", mutate: func(in *ApplyInput) { in.DesiredPort = 9999 }},
		{name: "missing idempotency key", mutate: func(in *ApplyInput) { in.IdempotencyKey = "" }},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			proxy := newInspectionFixture()
			service, _ := newTestService(proxy, time.Now)
			plan, err := service.Plan(context.Background(), PlanInput{
				Namespace: "network-repair-demo", PolicyName: "allow-frontend-to-backend", DestinationService: "backend",
			})
			if err != nil {
				t.Fatal(err)
			}
			input := ApplyInput{
				PlanID: plan.PlanID, Namespace: plan.Namespace, PolicyName: plan.PolicyName,
				CurrentPort: plan.CurrentPort, DesiredPort: plan.DesiredPort, IdempotencyKey: "demo-repair-001",
			}
			test.mutate(&input)

			_, err = service.Apply(context.Background(), input)
			if ErrorCodeOf(err) != ErrorNotAllowed {
				t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
			}
			if countRequests(proxy.requests, http.MethodPatch) != 0 {
				t.Fatal("mismatched approval fields sent PATCH")
			}
		})
	}
}

func TestApplyRejectsChangedLivePolicyBeforePATCH(t *testing.T) {
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, time.Now)
	plan, err := service.Plan(context.Background(), PlanInput{
		Namespace: "network-repair-demo", PolicyName: "allow-frontend-to-backend", DestinationService: "backend",
	})
	if err != nil {
		t.Fatal(err)
	}
	proxy.responses[http.MethodGet+" "+policyPath] = []byte(`{
		"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy",
		"metadata":{"name":"allow-frontend-to-backend","namespace":"network-repair-demo","resourceVersion":"rv-policy-changed"},
		"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"ingress":[{"ports":[{"protocol":"TCP","port":8081}]}]}
	}`)

	_, err = service.Apply(context.Background(), ApplyInput{
		PlanID: plan.PlanID, Namespace: plan.Namespace, PolicyName: plan.PolicyName,
		CurrentPort: plan.CurrentPort, DesiredPort: plan.DesiredPort, IdempotencyKey: "demo-repair-001",
	})
	if ErrorCodeOf(err) != ErrorResourceConflict {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
	if countRequests(proxy.requests, http.MethodPatch) != 0 {
		t.Fatal("changed live policy sent PATCH")
	}
}

func TestApplyMapsKubernetesConflictWithoutExposingBody(t *testing.T) {
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, time.Now)
	plan, err := service.Plan(context.Background(), PlanInput{
		Namespace: "network-repair-demo", PolicyName: "allow-frontend-to-backend", DestinationService: "backend",
	})
	if err != nil {
		t.Fatal(err)
	}
	proxy.errors[http.MethodPatch+" "+policyPath] = &cloudhubproxy.HTTPError{
		StatusCode: http.StatusConflict,
		Body:       []byte(`{"message":"sensitive upstream diagnostic"}`),
	}

	_, err = service.Apply(context.Background(), ApplyInput{
		PlanID: plan.PlanID, Namespace: plan.Namespace, PolicyName: plan.PolicyName,
		CurrentPort: plan.CurrentPort, DesiredPort: plan.DesiredPort, IdempotencyKey: "demo-repair-001",
	})
	if ErrorCodeOf(err) != ErrorResourceConflict {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
	if strings.Contains(err.Error(), "sensitive upstream diagnostic") {
		t.Fatalf("error exposed upstream body: %v", err)
	}
	if countRequests(proxy.requests, http.MethodPatch) != 1 {
		t.Fatalf("PATCH count = %d", countRequests(proxy.requests, http.MethodPatch))
	}
}

func TestApplyRejectsUnsupportedLivePolicyAndProxyFailure(t *testing.T) {
	tests := []struct {
		name     string
		prepare  func(*fixtureProxy)
		wantCode ErrorCode
	}{
		{
			name: "unsupported policy shape",
			prepare: func(proxy *fixtureProxy) {
				proxy.responses[http.MethodGet+" "+policyPath] = []byte(`{
					"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy",
					"metadata":{"name":"allow-frontend-to-backend","namespace":"network-repair-demo","resourceVersion":"rv-policy-1"},
					"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"ingress":[{"ports":[{"protocol":"TCP","port":8081},{"protocol":"TCP","port":9091}]}]}
				}`)
			},
			wantCode: ErrorNotAllowed,
		},
		{
			name: "proxy unavailable",
			prepare: func(proxy *fixtureProxy) {
				proxy.errors[http.MethodGet+" "+policyPath] = errors.New("connection refused")
			},
			wantCode: ErrorCloudHubProxyUnavailable,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			proxy := newInspectionFixture()
			service, _ := newTestService(proxy, time.Now)
			plan, err := service.Plan(context.Background(), PlanInput{
				Namespace: "network-repair-demo", PolicyName: "allow-frontend-to-backend", DestinationService: "backend",
			})
			if err != nil {
				t.Fatal(err)
			}
			test.prepare(proxy)

			_, err = service.Apply(context.Background(), ApplyInput{
				PlanID: plan.PlanID, Namespace: plan.Namespace, PolicyName: plan.PolicyName,
				CurrentPort: plan.CurrentPort, DesiredPort: plan.DesiredPort, IdempotencyKey: "demo-repair-001",
			})
			if ErrorCodeOf(err) != test.wantCode {
				t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
			}
			if countRequests(proxy.requests, http.MethodPatch) != 0 {
				t.Fatal("failed precondition sent PATCH")
			}
		})
	}
}

func TestVerifyReturnsResourceConflictWhenLivePortDiffers(t *testing.T) {
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, time.Now)
	plan, err := service.Plan(context.Background(), PlanInput{
		Namespace: "network-repair-demo", PolicyName: "allow-frontend-to-backend", DestinationService: "backend",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = service.Verify(context.Background(), VerifyInput{PlanID: plan.PlanID})
	if ErrorCodeOf(err) != ErrorResourceConflict {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
}

func TestRepairPlansAppliesAndVerifiesWithoutExternalPlanID(t *testing.T) {
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, time.Now)
	proxy.responseSequences[http.MethodGet+" "+policyPath] = [][]byte{
		wrongPolicyJSON(),
		wrongPolicyJSON(),
		fixedPolicyJSON(),
		fixedPolicyJSON(),
	}
	proxy.responses[http.MethodPatch+" "+policyPath] = fixedPolicyJSON()

	got, err := service.Repair(context.Background(), RepairInput{
		Namespace:           "network-repair-demo",
		SourceWorkload:      "frontend",
		DestinationService:  "backend",
		PolicyName:          "allow-frontend-to-backend",
		ExpectedCurrentPort: 8081,
		DesiredPort:         8080,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Namespace != "network-repair-demo" || got.PolicyName != "allow-frontend-to-backend" {
		t.Fatalf("identity fields = %#v", got)
	}
	if got.PreviousPort != 8081 || got.CurrentPort != 8080 || got.ResourceVersion != "rv-policy-2" {
		t.Fatalf("result state = %#v", got)
	}
	if !got.Verified || got.AlreadyRepaired {
		t.Fatalf("verification state = %#v", got)
	}
	if countRequests(proxy.requests, http.MethodPatch) != 1 {
		t.Fatalf("PATCH count = %d, want 1", countRequests(proxy.requests, http.MethodPatch))
	}
	const expectedPatch = `[{"op":"test","path":"/metadata/resourceVersion","value":"rv-policy-1"},{"op":"test","path":"/spec/ingress/0/ports/0/port","value":8081},{"op":"replace","path":"/spec/ingress/0/ports/0/port","value":8080}]`
	for _, request := range proxy.requests {
		if request.method == http.MethodPatch && string(request.body) != expectedPatch {
			t.Fatalf("PATCH body = %s", request.body)
		}
	}
}

func TestRepairReturnsAlreadyRepairedWithoutPatch(t *testing.T) {
	proxy := newInspectionFixture()
	proxy.responses[http.MethodGet+" "+policiesPath] = []byte(strings.ReplaceAll(string(proxy.responses[http.MethodGet+" "+policiesPath]), "8081", "8080"))
	service, _ := newTestService(proxy, time.Now)

	got, err := service.Repair(context.Background(), RepairInput{
		Namespace:           "network-repair-demo",
		SourceWorkload:      "frontend",
		DestinationService:  "backend",
		PolicyName:          "allow-frontend-to-backend",
		ExpectedCurrentPort: 8080,
		DesiredPort:         8080,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.PreviousPort != 8080 || got.CurrentPort != 8080 || got.ResourceVersion != "rv-policy-1" {
		t.Fatalf("result state = %#v", got)
	}
	if !got.Verified || !got.AlreadyRepaired {
		t.Fatalf("verification state = %#v", got)
	}
	if countRequests(proxy.requests, http.MethodPatch) != 0 {
		t.Fatalf("PATCH count = %d, want 0", countRequests(proxy.requests, http.MethodPatch))
	}
}

func TestRepairRejectsApprovalFieldMismatchBeforePatch(t *testing.T) {
	tests := []struct {
		name     string
		mutate   func(*RepairInput)
		wantCode ErrorCode
	}{
		{name: "wrong policy", mutate: func(in *RepairInput) { in.PolicyName = "other" }, wantCode: ErrorNotFound},
		{name: "wrong expected port", mutate: func(in *RepairInput) { in.ExpectedCurrentPort = 9090 }, wantCode: ErrorNotAllowed},
		{name: "wrong desired port", mutate: func(in *RepairInput) { in.DesiredPort = 9090 }, wantCode: ErrorNotAllowed},
		{name: "non-positive expected port", mutate: func(in *RepairInput) { in.ExpectedCurrentPort = 0 }, wantCode: ErrorNotAllowed},
		{name: "non-positive desired port", mutate: func(in *RepairInput) { in.DesiredPort = 0 }, wantCode: ErrorNotAllowed},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			proxy := newInspectionFixture()
			service, _ := newTestService(proxy, time.Now)
			input := RepairInput{
				Namespace:           "network-repair-demo",
				SourceWorkload:      "frontend",
				DestinationService:  "backend",
				PolicyName:          "allow-frontend-to-backend",
				ExpectedCurrentPort: 8081,
				DesiredPort:         8080,
			}
			test.mutate(&input)

			_, err := service.Repair(context.Background(), input)
			if ErrorCodeOf(err) != test.wantCode {
				t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
			}
			if countRequests(proxy.requests, http.MethodPatch) != 0 {
				t.Fatal("mismatched approval fields sent PATCH")
			}
		})
	}
}

func TestRepairDetectsChangeBetweenInspectionAndPlan(t *testing.T) {
	proxy := newInspectionFixture()
	service, _ := newTestService(proxy, time.Now)
	proxy.responseSequences[http.MethodGet+" "+policyPath] = [][]byte{changedPolicyJSON()}

	_, err := service.Repair(context.Background(), RepairInput{
		Namespace:           "network-repair-demo",
		SourceWorkload:      "frontend",
		DestinationService:  "backend",
		PolicyName:          "allow-frontend-to-backend",
		ExpectedCurrentPort: 8081,
		DesiredPort:         8080,
	})
	if ErrorCodeOf(err) != ErrorResourceConflict {
		t.Fatalf("error = %v, code = %q", err, ErrorCodeOf(err))
	}
	if countRequests(proxy.requests, http.MethodPatch) != 0 {
		t.Fatal("inspection/plan conflict sent PATCH")
	}
}
