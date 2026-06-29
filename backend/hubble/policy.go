package hubble

import (
	"sort"
	"strings"

	"github.com/cilium/cilium/api/v1/flow"
)

// PolicyRef identifies a Cilium / Kubernetes network policy that matched a
// flow. Hubble's Policy proto carries Name+Namespace+Labels+Revision but no
// explicit Kind — we infer Kind from the `io.cilium.k8s.policy.derived-from`
// label that Cilium attaches to derived policy rules.
type PolicyRef struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace,omitempty"`
	Kind      string   `json:"kind,omitempty"`
	Labels    []string `json:"labels,omitempty"`
	Revision  uint64   `json:"revision,omitempty"`
}

// PolicyRefCount is a ranked entry of policies referenced by an edge.
type PolicyRefCount struct {
	PolicyRef
	Count int64 `json:"count"`
}

// policyKey returns a stable composite key for deduplication.
func policyKey(p PolicyRef) string {
	return p.Kind + "|" + p.Namespace + "|" + p.Name
}

// policyRefFromFlow converts a Hubble Policy proto into a PolicyRef. Returns
// the zero value (Name == "") if the proto is nil or unnamed.
func policyRefFromFlow(p *flow.Policy) PolicyRef {
	if p == nil || p.GetName() == "" {
		return PolicyRef{}
	}
	labels := p.GetLabels()
	ref := PolicyRef{
		Name:      p.GetName(),
		Namespace: p.GetNamespace(),
		Kind:      policyKindFromLabels(labels),
		Revision:  p.GetRevision(),
	}
	if len(labels) > 0 {
		ref.Labels = append([]string(nil), labels...)
	}
	return ref
}

// policyRefsFromFlow collapses a []*flow.Policy slice into a deduplicated
// []PolicyRef ordered by appearance.
func policyRefsFromFlow(ps []*flow.Policy) []PolicyRef {
	if len(ps) == 0 {
		return nil
	}
	out := make([]PolicyRef, 0, len(ps))
	seen := map[string]bool{}
	for _, p := range ps {
		ref := policyRefFromFlow(p)
		if ref.Name == "" {
			continue
		}
		k := policyKey(ref)
		if seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, ref)
	}
	return out
}

// policyKindFromLabels extracts the Kubernetes Kind of the originating
// policy from Cilium's derived-from label. Examples:
//   - k8s:io.cilium.k8s.policy.derived-from=CiliumNetworkPolicy
//   - k8s:io.cilium.k8s.policy.derived-from=CiliumClusterwideNetworkPolicy
//   - k8s:io.cilium.k8s.policy.derived-from=K8sNetworkPolicy → NetworkPolicy
//
// Returns "" if no derived-from label is present.
func policyKindFromLabels(labels []string) string {
	const marker = "io.cilium.k8s.policy.derived-from="
	for _, l := range labels {
		idx := strings.Index(l, marker)
		if idx < 0 {
			continue
		}
		kind := l[idx+len(marker):]
		if kind == "K8sNetworkPolicy" {
			return "NetworkPolicy"
		}
		return kind
	}
	return ""
}

// rankPolicies returns the top-N policy buckets sorted by count desc.
func rankPolicies(m map[string]*policyBucket, limit int) []PolicyRefCount {
	if len(m) == 0 {
		return nil
	}
	out := make([]PolicyRefCount, 0, len(m))
	for _, b := range m {
		out = append(out, PolicyRefCount{PolicyRef: b.Ref, Count: b.Count})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return policyKey(out[i].PolicyRef) < policyKey(out[j].PolicyRef)
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}
