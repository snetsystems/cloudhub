package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	clog "github.com/snetsystems/cloudhub/backend/log"
)

func TestParseServiceExpiry(t *testing.T) {
	t.Parallel()

	t.Run("empty means never", func(t *testing.T) {
		got, err := ParseServiceExpiry("")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !got.IsZero() {
			t.Fatalf("got %v, want the zero time", got)
		}
	})

	t.Run("blanks are treated as empty", func(t *testing.T) {
		got, err := ParseServiceExpiry("   ")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !got.IsZero() {
			t.Fatalf("got %v, want the zero time", got)
		}
	})

	t.Run("a bare date serves through the end of that day", func(t *testing.T) {
		got, err := ParseServiceExpiry("2026-10-12")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := time.Date(2026, 10, 13, 0, 0, 0, 0, time.Local)
		if !got.Equal(want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})

	t.Run("an RFC3339 timestamp is taken as given", func(t *testing.T) {
		got, err := ParseServiceExpiry("2026-10-12T09:30:00Z")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := time.Date(2026, 10, 12, 9, 30, 0, 0, time.UTC)
		if !got.Equal(want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})

	t.Run("garbage is an error, not a silent never-expires", func(t *testing.T) {
		for _, value := range []string{"28d", "2026-13-40", "tomorrow", "1760000000"} {
			if _, err := ParseServiceExpiry(value); err == nil {
				t.Errorf("ParseServiceExpiry(%q) accepted an invalid value", value)
			}
		}
	})
}

func TestServiceExpiry(t *testing.T) {
	t.Parallel()

	served := func(expiresAt time.Time, method, target string, header http.Header) *httptest.ResponseRecorder {
		next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("served"))
		})

		handler := ServiceExpiry(expiresAt, "", clog.New(clog.ParseLevel("error")), next)

		req := httptest.NewRequest(method, target, nil)
		for key, values := range header {
			for _, value := range values {
				req.Header.Add(key, value)
			}
		}

		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)

	t.Run("no expiry configured lets everything through", func(t *testing.T) {
		rec := served(time.Time{}, "GET", "/cloudhub/v1/me", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("got %d, want 200", rec.Code)
		}
	})

	t.Run("before the expiry lets everything through", func(t *testing.T) {
		rec := served(future, "GET", "/cloudhub/v1/me", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("got %d, want 200", rec.Code)
		}
	})

	t.Run("an expired API call gets JSON a client can branch on", func(t *testing.T) {
		rec := served(past, "GET", "/cloudhub/v1/me", nil)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("got %d, want 403", rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
			t.Fatalf("Content-Type %q, want JSON", ct)
		}
		if body := rec.Body.String(); !strings.Contains(body, `"expired":true`) {
			t.Fatalf("body %q is missing the expired flag", body)
		}
	})

	t.Run("the login page and bundle are refused too", func(t *testing.T) {
		// AuthorizedToken never sees these paths, which is the whole reason
		// this gate sits outside it.
		for _, target := range []string{"/", "/basic/login", "/app.js", "/oauth/github/login"} {
			rec := served(past, "GET", target, nil)
			if rec.Code != http.StatusForbidden {
				t.Errorf("%s: got %d, want 403", target, rec.Code)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/html") {
				t.Errorf("%s: Content-Type %q, want HTML", target, ct)
			}
		}
	})

	t.Run("an expired browser request gets a self-contained notice", func(t *testing.T) {
		rec := served(past, "GET", "/", nil)
		body := rec.Body.String()
		if !strings.Contains(body, "Evaluation period has ended") {
			t.Fatalf("body is missing the notice: %q", body)
		}
		for _, external := range []string{"<script", "<link"} {
			if strings.Contains(body, external) {
				t.Fatalf("notice pulls in %s, but every asset request is refused", external)
			}
		}
	})

	t.Run("the notice carries both contacts in Korean and English", func(t *testing.T) {
		// The notice is the only thing an expired tenant can still reach, so
		// it has to be the whole handover: who to call, in either language.
		rec := served(past, "GET", "/", nil)
		body := rec.Body.String()

		for _, want := range []string{
			// Reachable details for both contacts.
			"kyungyong.kim@goodussolution.com", "010-5477-9150",
			"yongsik.lee@snetsystems.co.kr", "010-9166-0275",
			// Korean pane, which is what a visitor sees with no fragment.
			"평가 기간이 종료되었습니다", "김경용", "이용식",
			// English pane, reached through the :target switch.
			"Evaluation period has ended", "Kyungyong Kim", "Yongsik Lee",
			// The switch, and both marks carried in the document itself.
			`href="#ko"`, `href="#en"`, "<svg", "data:image/png;base64,",
		} {
			if !strings.Contains(body, want) {
				t.Errorf("notice is missing %q", want)
			}
		}
	})

	t.Run("every placeholder is substituted and the date lands in both panes", func(t *testing.T) {
		rec := served(past, "GET", "/", nil)
		body := rec.Body.String()

		for _, placeholder := range []string{expiryDatePlaceholder, snetMarkPlaceholder} {
			if strings.Contains(body, placeholder) {
				t.Errorf("notice still holds the unsubstituted %s", placeholder)
			}
		}
		if !strings.Contains(body, snetSymbolPNG) {
			t.Error("the SNet mark did not make it into the notice")
		}
		if got := strings.Count(body, past.Format(ExpiryDateLayout)); got != 2 {
			t.Errorf("the date appears %d times, want once per language pane", got)
		}
	})

	t.Run("an XHR outside the API prefixes still gets JSON", func(t *testing.T) {
		header := http.Header{"X-Requested-With": []string{"XMLHttpRequest"}}
		rec := served(past, "GET", "/some/other/path", header)
		if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
			t.Fatalf("Content-Type %q, want JSON", ct)
		}
	})

	t.Run("ping stays open so uptime checks do not read a trial end as a crash", func(t *testing.T) {
		rec := served(past, "GET", "/ping", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("got %d, want 200", rec.Code)
		}
	})
}
