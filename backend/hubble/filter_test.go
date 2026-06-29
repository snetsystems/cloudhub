package hubble

import "testing"

func TestExcludedPatterns_GlobMatching(t *testing.T) {
	p := NewExcludedNamespacePatterns([]string{"kube-*", "cilium*", "monitoring"})
	cases := map[string]bool{
		"kube-system":   true,
		"kube-public":   true,
		"cilium":        true,
		"cilium-system": true,
		"monitoring":    true,
		"default":       false,
		"my-app":        false,
	}
	for ns, want := range cases {
		if got := p.IsSystem(ns); got != want {
			t.Errorf("IsSystem(%q) = %v, want %v", ns, got, want)
		}
	}
}
