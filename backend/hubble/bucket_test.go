package hubble

import (
	"testing"
	"time"
)

func TestBucket_AddFlow_CountsAndAttributes(t *testing.T) {
	b := NewBucket(time.Now())
	k := EdgeKey{Src: "ns:default", Dst: "ns:kube-system", Verdict: "FORWARDED"}

	allow := []PolicyRef{{Name: "allow-dns", Namespace: "default", Kind: "CiliumNetworkPolicy"}}
	deny := []PolicyRef{{Name: "deny-all", Namespace: "default", Kind: "CiliumNetworkPolicy"}}
	now := time.Now()

	b.Add(k, now, "", allow, nil, "HTTP GET /healthz")
	b.Add(k, now, "", allow, nil, "HTTP GET /healthz")
	b.Add(k, now, "policy_denied", nil, deny, "")

	c := b.Edges[k]
	if c.FlowCount != 3 {
		t.Fatalf("FlowCount got %d, want 3", c.FlowCount)
	}
	allowKey := policyKey(allow[0])
	if c.AllowedPolicies[allowKey] == nil || c.AllowedPolicies[allowKey].Count != 2 {
		t.Fatalf("AllowedPolicies[allow-dns] got %v, want count=2", c.AllowedPolicies[allowKey])
	}
	denyKey := policyKey(deny[0])
	if c.DeniedPolicies[denyKey] == nil || c.DeniedPolicies[denyKey].Count != 1 {
		t.Fatalf("DeniedPolicies[deny-all] got %v, want count=1", c.DeniedPolicies[denyKey])
	}
	if c.DenyReasons["policy_denied"] != 1 {
		t.Fatalf("denyReasons[policy_denied] got %d, want 1", c.DenyReasons["policy_denied"])
	}
	if c.L7["HTTP GET /healthz"] != 2 {
		t.Fatalf("L7[HTTP GET /healthz] got %d, want 2", c.L7["HTTP GET /healthz"])
	}
	if !c.LastSeen.Equal(now) {
		t.Fatalf("LastSeen got %v, want %v", c.LastSeen, now)
	}
}

func TestEdgeKey_UsableAsMapKey(t *testing.T) {
	m := map[EdgeKey]int{}
	k1 := EdgeKey{Src: "a", Dst: "b", Verdict: "FORWARDED"}
	k2 := EdgeKey{Src: "a", Dst: "b", Verdict: "FORWARDED"}
	m[k1] = 1
	if m[k2] != 1 {
		t.Fatal("EdgeKey equality broken")
	}
}
