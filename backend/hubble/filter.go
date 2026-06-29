package hubble

import "path/filepath"

// ExcludedNamespacePatterns matches namespace names against a glob list to flag system namespaces.
type ExcludedNamespacePatterns struct {
	patterns []string
}

func NewExcludedNamespacePatterns(patterns []string) *ExcludedNamespacePatterns {
	return &ExcludedNamespacePatterns{patterns: patterns}
}

// IsSystem reports whether the namespace matches any excluded pattern (glob).
func (e *ExcludedNamespacePatterns) IsSystem(ns string) bool {
	for _, pat := range e.patterns {
		if matched, _ := filepath.Match(pat, ns); matched {
			return true
		}
	}
	return false
}
