package hubble

import (
	"fmt"
	"strings"
	"sync"

	"github.com/cilium/cilium/api/v1/flow"
)

const (
	reservedIdentityHost          uint32 = 1
	reservedIdentityWorld         uint32 = 2
	reservedIdentityRemoteNode    uint32 = 6
	reservedIdentityKubeAPIServer uint32 = 7
)

const (
	workloadStrengthUnknown = iota
	workloadStrengthPod
	workloadStrengthLabel
	workloadStrengthWorkload
)

type endpointMetadata struct {
	namespace        string
	workload         string
	workloadStrength int
}

type resolvedEndpoint struct {
	externalID string
	namespace  string
	workload   string
}

func (e resolvedEndpoint) ID(level Level) string {
	if e.externalID != "" {
		return e.externalID
	}
	if level == LevelNamespace {
		return "ns:" + e.namespace
	}
	return "wl:" + e.namespace + "/" + e.workload
}

// EndpointResolver canonicalizes endpoint metadata for one cluster runtime.
// Cilium security identities are cluster-scoped, so resolvers must not be
// shared between ClusterRuntime instances.
type EndpointResolver struct {
	mu         sync.RWMutex
	byIdentity map[uint32]endpointMetadata
}

func NewEndpointResolver() *EndpointResolver {
	return &EndpointResolver{byIdentity: make(map[uint32]endpointMetadata)}
}

func (r *EndpointResolver) MapFlow(f *flow.Flow, level Level) (string, string) {
	if f == nil {
		return "ext:unknown", "ext:unknown"
	}
	src := r.ResolveEndpoint(f.GetSource(), f.GetSourceNames())
	dst := r.ResolveEndpoint(f.GetDestination(), f.GetDestinationNames())
	return src.ID(level), dst.ID(level)
}

func (r *EndpointResolver) ResolveEndpoint(ep *flow.Endpoint, dnsNames []string) resolvedEndpoint {
	if ep == nil {
		return resolvedEndpoint{externalID: "ext:unknown"}
	}

	switch ep.GetIdentity() {
	case reservedIdentityHost:
		return resolvedEndpoint{externalID: "ext:reserved:host"}
	case reservedIdentityWorld:
		if service, ok := kubernetesServiceEndpoint(dnsNames); ok {
			return service
		}
		if name := firstNonEmpty(dnsNames); name != "" {
			return resolvedEndpoint{externalID: "ext:fqdn:" + name}
		}
		return resolvedEndpoint{externalID: "ext:unknown"}
	case reservedIdentityRemoteNode:
		return resolvedEndpoint{externalID: "ext:reserved:remote-node"}
	case reservedIdentityKubeAPIServer:
		return resolvedEndpoint{externalID: "ext:reserved:kube-apiserver"}
	}

	namespace := ep.GetNamespace()
	if namespace == "" {
		namespace = labelValue(ep.GetLabels(), "k8s:io.kubernetes.pod.namespace=")
	}
	workload, strength := workloadCandidate(ep)

	if identity := ep.GetIdentity(); identity != 0 {
		r.mu.Lock()
		cached := r.byIdentity[identity]
		if namespace == "" {
			namespace = cached.namespace
		} else {
			cached.namespace = namespace
		}
		if cached.workload != "" && cached.workloadStrength > strength {
			workload = cached.workload
			strength = cached.workloadStrength
		}
		if strength >= workloadStrengthLabel &&
			(cached.workload == "" || strength >= cached.workloadStrength) {
			cached.workload = workload
			cached.workloadStrength = strength
		}
		if cached.namespace != "" || cached.workload != "" {
			r.byIdentity[identity] = cached
		}
		r.mu.Unlock()
	}

	if namespace == "" {
		if service, ok := kubernetesServiceEndpoint(dnsNames); ok {
			return service
		}
		if name := firstNonEmpty(dnsNames); name != "" {
			return resolvedEndpoint{externalID: "ext:fqdn:" + name}
		}
		return resolvedEndpoint{externalID: "ext:unknown"}
	}
	if workload == "" {
		if ep.GetIdentity() != 0 {
			workload = fmt.Sprintf("Unknown Workload (%d)", ep.GetIdentity())
		} else {
			workload = "Unknown Workload"
		}
	}
	return resolvedEndpoint{namespace: namespace, workload: workload}
}

// kubernetesServiceEndpoint recognizes the canonical Kubernetes service DNS
// shape: <service>.<namespace>.svc.<cluster-domain>. The cluster domain is not
// assumed to be cluster.local because Kubernetes allows it to be customized.
func kubernetesServiceEndpoint(values []string) (resolvedEndpoint, bool) {
	for _, value := range values {
		name := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(value)), ".")
		labels := strings.Split(name, ".")
		if len(labels) < 3 || labels[0] == "" || labels[1] == "" || labels[2] != "svc" {
			continue
		}
		return resolvedEndpoint{namespace: labels[1], workload: labels[0]}, true
	}
	return resolvedEndpoint{}, false
}

func workloadCandidate(ep *flow.Endpoint) (string, int) {
	for _, workload := range ep.GetWorkloads() {
		if workload.GetName() != "" {
			return workload.GetName(), workloadStrengthWorkload
		}
	}
	for _, prefix := range []string{
		"k8s:app.kubernetes.io/name=",
		"k8s:k8s-app=",
		"k8s:app=",
	} {
		if value := labelValue(ep.GetLabels(), prefix); value != "" {
			return value, workloadStrengthLabel
		}
	}
	if ep.GetPodName() != "" {
		return ep.GetPodName(), workloadStrengthPod
	}
	return "", workloadStrengthUnknown
}

func labelValue(labels []string, prefix string) string {
	for _, label := range labels {
		if strings.HasPrefix(label, prefix) {
			return strings.TrimPrefix(label, prefix)
		}
	}
	return ""
}

func firstNonEmpty(values []string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
