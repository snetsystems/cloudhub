package kubeapi

import (
	"encoding/json"
	"testing"
)

func TestMinimalKubernetesTypesDecodeInspectionFields(t *testing.T) {
	var deployment Deployment
	if err := json.Unmarshal([]byte(`{
		"apiVersion":"apps/v1",
		"kind":"Deployment",
		"metadata":{"name":"frontend","namespace":"demo","resourceVersion":"rv-deploy","labels":{"app":"frontend"}},
		"spec":{"selector":{"matchLabels":{"app":"frontend"}}}
	}`), &deployment); err != nil {
		t.Fatal(err)
	}
	if deployment.Metadata.Name != "frontend" || deployment.Spec.Selector.MatchLabels["app"] != "frontend" {
		t.Fatalf("deployment fields not decoded: %#v", deployment)
	}

	var service Service
	if err := json.Unmarshal([]byte(`{
		"apiVersion":"v1",
		"kind":"Service",
		"metadata":{"name":"backend","namespace":"demo"},
		"spec":{"selector":{"app":"backend"},"ports":[{"name":"http","protocol":"TCP","port":8080,"targetPort":"backend-http"}]}
	}`), &service); err != nil {
		t.Fatal(err)
	}
	if service.Spec.Selector["app"] != "backend" || service.Spec.Ports[0].Port != 8080 {
		t.Fatalf("service fields not decoded: %#v", service)
	}
	if string(service.Spec.Ports[0].TargetPort) != `"backend-http"` {
		t.Fatalf("targetPort = %s", service.Spec.Ports[0].TargetPort)
	}

	var endpointSlices EndpointSliceList
	if err := json.Unmarshal([]byte(`{
		"apiVersion":"discovery.k8s.io/v1",
		"kind":"EndpointSliceList",
		"items":[{
			"metadata":{"name":"backend-abc","labels":{"kubernetes.io/service-name":"backend"}},
			"ports":[{"name":"backend-http","protocol":"TCP","port":8080}],
			"endpoints":[{"addresses":["10.0.0.8"],"conditions":{"ready":true},"targetRef":{"kind":"Pod","name":"backend-1","namespace":"demo"}}]
		}]
	}`), &endpointSlices); err != nil {
		t.Fatal(err)
	}
	if endpointSlices.Items[0].Endpoints[0].TargetRef.Name != "backend-1" || *endpointSlices.Items[0].Ports[0].Port != 8080 {
		t.Fatalf("endpoint slice fields not decoded: %#v", endpointSlices)
	}

	var policies NetworkPolicyList
	if err := json.Unmarshal([]byte(`{
		"apiVersion":"networking.k8s.io/v1",
		"kind":"NetworkPolicyList",
		"items":[{
			"apiVersion":"networking.k8s.io/v1",
			"kind":"NetworkPolicy",
			"metadata":{"name":"allow-frontend-to-backend","namespace":"demo","resourceVersion":"rv-policy-1"},
			"spec":{"podSelector":{"matchLabels":{"app":"backend"}},"policyTypes":["Ingress"],"ingress":[{"ports":[{"protocol":"TCP","port":8081}]}]}
		}]
	}`), &policies); err != nil {
		t.Fatal(err)
	}
	policy := policies.Items[0]
	if policy.Metadata.ResourceVersion != "rv-policy-1" || policy.Spec.PodSelector.MatchLabels["app"] != "backend" {
		t.Fatalf("policy fields not decoded: %#v", policy)
	}
	if string(policy.Spec.Ingress[0].Ports[0].Port) != "8081" {
		t.Fatalf("policy port = %s", policy.Spec.Ingress[0].Ports[0].Port)
	}
}
