package server

import (
	"fmt"
	"net/http"
	"path"
	"strings"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ExpiryDateLayout is the short form accepted for --service-expires-at. The
// whole of that day is still served: see ParseServiceExpiry.
const ExpiryDateLayout = "2006-01-02"

// ParseServiceExpiry turns the --service-expires-at value into the instant the
// service stops serving. An empty value yields the zero time, which means the
// service never expires.
//
// A bare date is taken to include that whole day in the server's local zone —
// "2026-10-12" serves until 2026-10-13 00:00, because an operator writing a
// date means "up to and including this day". RFC3339 is accepted as well for
// anyone who needs a particular hour.
func ParseServiceExpiry(value string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}, nil
	}

	if day, err := time.ParseInLocation(ExpiryDateLayout, trimmed, time.Local); err == nil {
		return day.AddDate(0, 0, 1), nil
	}

	at, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return time.Time{}, fmt.Errorf(
			"service-expires-at %q is neither a %s date nor an RFC3339 timestamp",
			value, ExpiryDateLayout)
	}

	return at, nil
}

// expiryNoticeHTML is served to a browser once the service has expired. It
// carries no CSS or script of its own: every asset request is refused too, so
// anything external would fail to load.
const expiryNoticeHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CloudHub &mdash; Evaluation period ended</title>
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1c1c21;
    color: #bec2cc;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 34rem; padding: 2rem; text-align: center; }
  h1 { margin: 0 0 1rem; font-size: 1.5rem; color: #f3f4f7; font-weight: 600; }
  p { margin: 0 0 0.75rem; }
  .date { color: #f3f4f7; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>Evaluation period has ended</h1>
  <p>This CloudHub evaluation expired on <span class="date">%s</span>.</p>
  <p>Contact your administrator to continue.</p>
</main>
</body>
</html>
`

// isAPIRequest reports whether the caller wants a machine-readable answer
// rather than a page. The SPA's own calls all live under the versioned API
// prefixes; the header checks cover callers outside it, such as the MCP
// callbacks under /api.
func isAPIRequest(r *http.Request, basepath string) bool {
	cleanPath := path.Clean(r.URL.Path)
	for _, prefix := range []string{"/cloudhub", "/api"} {
		if strings.HasPrefix(cleanPath, path.Join(basepath, prefix)) {
			return true
		}
	}

	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		return true
	}

	return r.Header.Get("X-Requested-With") == "XMLHttpRequest"
}

// ServiceExpiry refuses every request once expiresAt has passed.
//
// It wraps the whole mux rather than sitting with the role middleware, because
// AuthorizedToken only guards the versioned API prefixes: login, the OAuth
// callbacks and the React bundle all bypass it. A trial has to close those
// too, or the tenant simply logs in again.
//
// A zero expiresAt disables the gate, which is what an ordinary install gets.
// /ping stays open so a load balancer or uptime check does not read an expired
// trial as a crashed process.
func ServiceExpiry(
	expiresAt time.Time,
	basepath string,
	logger cloudhub.Logger,
	next http.Handler,
) http.Handler {
	if expiresAt.IsZero() {
		return next
	}

	notice := fmt.Sprintf(expiryNoticeHTML, expiresAt.Format(ExpiryDateLayout))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if time.Now().Before(expiresAt) {
			next.ServeHTTP(w, r)
			return
		}

		if path.Clean(r.URL.Path) == path.Join(basepath, "/ping") {
			next.ServeHTTP(w, r)
			return
		}

		logger.
			WithField("component", "service_expiry").
			WithField("remote_addr", r.RemoteAddr).
			WithField("url", r.URL).
			Info("Service expired; refusing request")

		if isAPIRequest(r, basepath) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusForbidden)
			fmt.Fprintf(w,
				`{"code":403,"message":"CloudHub evaluation period ended on %s","expired":true}`,
				expiresAt.Format(ExpiryDateLayout))
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusForbidden)
		fmt.Fprint(w, notice)
	})
}
