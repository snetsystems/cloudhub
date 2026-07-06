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

	b.Add(k, now, "", allow, nil, "HTTP GET /healthz", FlowExtras{})
	b.Add(k, now, "", allow, nil, "HTTP GET /healthz", FlowExtras{})
	b.Add(k, now, "policy_denied", nil, deny, "", FlowExtras{})

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

func TestBucket_TracksActiveConnsAndL7Latency(t *testing.T) {
	b := NewBucket(time.Now())
	k := EdgeKey{Src: "ns:default", Dst: "ns:kube-system", Verdict: "FORWARDED"}
	now := time.Now()

	http := func(conn uint64, latMs int64) FlowExtras {
		return FlowExtras{
			ConnHash:  conn,
			L7Type:    "HTTP",
			LatencyNs: latMs * int64(time.Millisecond),
		}
	}
	b.Add(k, now, "", nil, nil, "HTTP GET /a", http(111, 4))
	b.Add(k, now, "", nil, nil, "HTTP GET /a", http(111, 8)) // same conn
	b.Add(k, now, "", nil, nil, "HTTP GET /b", http(222, 6))
	b.Add(k, now, "", nil, nil, "", FlowExtras{ConnHash: 333}) // plain L4

	c := b.Edges[k]
	if got := len(c.ConnHashes); got != 3 {
		t.Fatalf("ConnHashes got %d, want 3", got)
	}
	s := c.L7Stats["HTTP"]
	if s == nil || s.Count != 3 {
		t.Fatalf("L7Stats[HTTP] got %+v, want Count=3", s)
	}
	if s.LatencyCount != 3 ||
		s.LatencySum != 18*int64(time.Millisecond) ||
		s.LatencyMax != 8*int64(time.Millisecond) {
		t.Fatalf("latency aggregation got %+v", s)
	}
}

func TestBucket_TracksExternalIPs(t *testing.T) {
	b := NewBucket(time.Now())
	k := EdgeKey{Src: "ns:default", Dst: "ext:unknown", Verdict: "FORWARDED"}
	now := time.Now()

	b.Add(k, now, "", nil, nil, "", FlowExtras{ExternalIP: "203.0.113.9"})
	b.Add(k, now, "", nil, nil, "", FlowExtras{ExternalIP: "203.0.113.9"})
	b.Add(k, now, "", nil, nil, "", FlowExtras{ExternalIP: "198.51.100.7"})
	b.Add(k, now, "", nil, nil, "", FlowExtras{}) // no external side

	c := b.Edges[k]
	if c.ExternalIPs["203.0.113.9"] != 2 || c.ExternalIPs["198.51.100.7"] != 1 {
		t.Fatalf("ExternalIPs got %v, want 203.0.113.9:2 198.51.100.7:1", c.ExternalIPs)
	}
	if len(c.ExternalIPs) != 2 {
		t.Fatalf("ExternalIPs size got %d, want 2", len(c.ExternalIPs))
	}
}

func TestBucket_ConnHashesCapped(t *testing.T) {
	b := NewBucket(time.Now())
	k := EdgeKey{Src: "ns:a", Dst: "ns:b", Verdict: "FORWARDED"}
	now := time.Now()

	for i := 0; i < connHashesPerBucketCap+10; i++ {
		b.Add(k, now, "", nil, nil, "", FlowExtras{ConnHash: uint64(i + 1)})
	}

	c := b.Edges[k]
	if got := len(c.ConnHashes); got != connHashesPerBucketCap {
		t.Fatalf("ConnHashes got %d, want cap %d", got, connHashesPerBucketCap)
	}
	if !c.ConnCapped {
		t.Fatal("ConnCapped should be true after exceeding the cap")
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
