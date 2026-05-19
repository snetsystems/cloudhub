package builtin

import (
	"context"
	"encoding/json"
	"strings"
	"sync"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// BinAlertTemplatesStore loads alert templates from the JSON files under
// backend/builtin/alerts/, embedded via go-bindata. Read-only.
//
// The parsed result is memoized on first All()/Get() — embedded assets are
// compile-time immutable, so reparsing on every request is wasted work. The
// underlying slice is shared across callers (templates are treated as
// read-only by handlers; do not mutate).
type BinAlertTemplatesStore struct {
	Logger cloudhub.Logger

	once   sync.Once
	cached []cloudhub.AlertTemplate
}

const alertAssetPrefix = "alerts/"

// load parses every embedded JSON asset exactly once and stores the result.
// Invalid files are logged and skipped so a single bad asset does not break
// the whole list. Subsequent calls return the cached slice.
func (s *BinAlertTemplatesStore) load() []cloudhub.AlertTemplate {
	s.once.Do(func() {
		names := AssetNames()
		out := make([]cloudhub.AlertTemplate, 0, len(names))
		for _, name := range names {
			if !strings.HasPrefix(name, alertAssetPrefix) || !strings.HasSuffix(name, ".json") {
				continue
			}
			octets, err := Asset(name)
			if err != nil {
				s.Logger.
					WithField("component", "builtin").
					WithField("name", name).
					Error("alert template asset read failed: ", err)
				continue
			}
			var tmpl cloudhub.AlertTemplate
			if err := json.Unmarshal(octets, &tmpl); err != nil {
				s.Logger.
					WithField("component", "builtin").
					WithField("name", name).
					Error("alert template unmarshal failed: ", err)
				continue
			}
			out = append(out, tmpl)
		}
		s.cached = out
	})
	return s.cached
}

// All returns every embedded alert template. The result is served from the
// in-memory cache after the first call.
func (s *BinAlertTemplatesStore) All(ctx context.Context) ([]cloudhub.AlertTemplate, error) {
	return s.load(), nil
}

// Get retrieves a single template by ID. Returns ErrAlertTemplateNotFound when
// no embedded asset matches.
func (s *BinAlertTemplatesStore) Get(ctx context.Context, id string) (cloudhub.AlertTemplate, error) {
	for _, t := range s.load() {
		if t.ID == id {
			return t, nil
		}
	}
	return cloudhub.AlertTemplate{}, cloudhub.ErrAlertTemplateNotFound
}
