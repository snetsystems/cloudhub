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

// expiryDatePlaceholder is substituted into expiryNoticeHTML. It is a marker
// rather than a %s verb so the notice can carry the literal percent signs an
// inlined SVG or CSS may contain.
const expiryDatePlaceholder = "{{EXPIRED_ON}}"

// snetMarkPlaceholder is where the base64 payload of snetSymbolPNG goes.
const snetMarkPlaceholder = "{{SNET_MARK}}"

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
// anything external would fail to load. That is also why the logo is an
// inlined SVG, why the SNet mark is a base64 data URI, and why the
// Korean/English switch is the CSS :target trick rather than a click handler.
//
// The English pane is first in the document only so that `#en:target ~ #ko`
// can hide the Korean one; there is no previous-sibling combinator. Korean is
// what a visitor sees with no fragment, which is also the no-CSS fallback.
const expiryNoticeHTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CloudHub &mdash; 평가 기간 종료 / Evaluation period ended</title>
<style>
  :root {
    --bg: #12141a;
    --bg-soft: #1c1c21;
    --card: rgba(255, 255, 255, 0.035);
    --line: rgba(255, 255, 255, 0.09);
    --text: #bec2cc;
    --text-strong: #f3f4f7;
    --muted: #767a86;
    --accent: #22adf6;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    background: radial-gradient(120% 90% at 50% 0%, #1f2530 0%, var(--bg) 60%, var(--bg-soft) 100%);
    color: var(--text);
    font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  main {
    width: 100%;
    max-width: 48rem;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "brand lang"
      "pane  pane";
    align-items: center;
    gap: 1.75rem 1rem;
  }

  /* Brand -------------------------------------------------------------- */

  .brand {
    grid-area: brand;
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .brand img { width: 2.6rem; height: 2.6rem; display: block; }
  .brand svg { width: 8.75rem; height: auto; display: block; }
  .brand .rule {
    width: 1px;
    height: 1.9rem;
    background: var(--line);
  }
  .logo-mark { fill: var(--accent); }
  .logo-type { fill: var(--text-strong); }

  /* Language switch ---------------------------------------------------- */

  nav {
    grid-area: lang;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }
  nav a {
    color: var(--muted);
    text-decoration: none;
    padding: 0.25rem 0.6rem;
    border: 1px solid transparent;
    border-radius: 999px;
  }
  nav a:hover { color: var(--text-strong); }
  nav a[href="#ko"] {
    color: var(--text-strong);
    border-color: var(--line);
    background: var(--card);
  }
  #en:target ~ nav a[href="#ko"] {
    color: var(--muted);
    border-color: transparent;
    background: none;
  }
  #en:target ~ nav a[href="#en"] {
    color: var(--text-strong);
    border-color: var(--line);
    background: var(--card);
  }

  /* Panes -------------------------------------------------------------- */

  section { grid-area: pane; }
  #en { display: none; }
  #en:target { display: block; }
  #en:target ~ #ko { display: none; }

  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.5rem;
    line-height: 1.35;
    font-weight: 600;
    color: var(--text-strong);
    letter-spacing: -0.01em;
  }
  .lede { margin: 0 0 2rem; }
  .date { color: var(--text-strong); font-weight: 600; }

  /* Contacts ----------------------------------------------------------- */

  .contacts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
  }
  article {
    display: flex;
    flex-direction: column;
    padding: 1.25rem 1.25rem 1.1rem;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 0.5rem;
  }
  .role {
    margin: 0 0 0.7rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .name {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--text-strong);
  }
  .name span { font-size: 0.875rem; font-weight: 400; color: var(--text); }
  /* margin-top:auto keeps the two cards' contact rows on the same line even
     when one org name wraps to a second line. */
  dl {
    margin: 0;
    margin-top: auto;
    padding-top: 0.95rem;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 0.75rem;
    font-size: 0.875rem;
  }
  dt {
    color: var(--muted);
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    align-self: center;
  }
  dd { margin: 0; overflow-wrap: anywhere; }
  dd a { color: var(--text-strong); text-decoration: none; }
  dd a:hover { color: var(--accent); text-decoration: underline; }

  @media (max-width: 30rem) {
    main { gap: 1.25rem 0.75rem; }
    h1 { font-size: 1.25rem; }
  }
</style>
</head>
<body>
<main>
  <div class="brand">
    <img src="data:image/png;base64,{{SNET_MARK}}" width="128" height="128" alt="SNet Systems">
    <span class="rule"></span>
    <svg viewBox="0 0 841.9 355" role="img" aria-label="CloudHub">
      <path class="logo-mark" d="M430.6,264.5v-94.9c11.4-0.7,23.6-1.2,38.7-1.2c9.6,0,17.2,1.1,23.3,3.6c-15.6-26.7-44.7-44.7-77.9-44.7
        c-3.1,0-6.2,0.2-9.2,0.5C390,80.7,345.9,46.9,293.8,46.9c-44.4,0-83,24.5-103,60.8c-12.3-5.1-25.7-7.9-39.9-7.9
        C93.5,99.7,47,146.3,47,203.6c0,57.4,46.5,103.9,103.9,103.9h263.9c33.5,0,62.8-18.3,78.3-45.5c-6.1,2.6-13.9,3.7-23.7,3.7
        C454.3,265.7,442,265.2,430.6,264.5z"/>
      <path class="logo-type" d="M153.4,171.1l-1.9,15.7c-9.4-0.5-15.5-0.7-28-0.7c-14.5,0-18.8,7-18.8,31c0,23.9,4.3,31,18.8,31
        c13.3,0,21.2-0.1,30-1.2l1.9,15.5c-9.2,2.8-17.6,3.8-31.9,3.8c-30.8,0-41.9-12.9-41.9-49.1c0-36.2,11.1-49.1,41.9-49.1
        C137.5,167.9,144.3,168.9,153.4,171.1z"/>
      <path class="logo-type" d="M188.4,240.4c0,5,2.2,7,7.8,7h34.2l1,16c-13.3,1.4-28,1.5-42.2,1.5c-16,0-22.8-8.5-22.8-20.2v-75.1h22V240.4z"/>
      <path class="logo-type" d="M321.3,217c0,38.1-11.3,49.3-42.8,49.3c-31.5,0-42.6-11.1-42.6-49.3c0-38.1,11.1-49.3,42.6-49.3
        C310,167.8,321.3,178.9,321.3,217z M259,217c0,25.2,4.5,32.3,19.5,32.3c15,0,19.5-7.2,19.5-32.3c0-25.2-4.5-32.3-19.5-32.3
        C263.5,184.7,259,191.8,259,217z"/>
      <path class="logo-type" d="M414.2,226.7c0,29-10.4,39.6-38.9,39.6c-30.1,0-40.9-10.6-40.9-39.6v-57.1h22v57.1c0,17.5,4.3,22.7,17.9,22.7
        c13.3,0,17.8-5.2,17.8-22.7v-57.1h22.1V226.7z"/>
      <path class="logo-type" d="M492.6,171.9c-6.1-2.5-13.7-3.6-23.3-3.6c-15.2,0-27.3,0.6-38.7,1.2v94.9c11.4,0.7,23.7,1.2,38.7,1.2
        c9.8,0,17.6-1.1,23.7-3.7c7.5-13.2,11.9-28.4,11.9-44.7C504.9,200.7,500.5,185.2,492.6,171.9z M469.4,249.2
        c-6.1,0-11.7-0.1-16.8-0.1v-64.3c5.1,0,10.4-0.1,16.8-0.1c14.9,0,19.4,7.4,19.4,32.3C488.7,241.9,484.2,249.2,469.4,249.2z"/>
      <path class="logo-mark" d="M604.8,264.5h-22v-42.4h-35.3v42.4h-22v-94.9h22v36.3h35.3v-36.3h22V264.5z"/>
      <path class="logo-mark" d="M701.1,226.7c0,29-10.4,39.6-38.9,39.6c-30.1,0-40.9-10.6-40.9-39.6v-57.1h22v57.1c0,17.5,4.3,22.7,17.9,22.7
        c13.3,0,17.8-5.2,17.8-22.7v-57.1h22.1V226.7z"/>
      <path class="logo-mark" d="M772.8,215.5c15.3,1.2,20.7,10.2,20.7,25.3c0,19.5-10,24.8-33.8,24.8c-19.1,0-29.5-0.1-42-1.1v-94.9
        c11.3-1,20.7-1.1,37.4-1.1c26,0,35.2,5.2,35.2,24.8c0,13.6-5.1,20.6-17.5,21.7V215.5z M754,184.3h-14.9v24.1h16
        c10.7,0,14-2.5,14-12.2C769.2,186.5,765.6,184.3,754,184.3z M755.9,249.8c12,0,15.5-2.3,15.5-12.9c0-11.6-3.6-14.4-16-14.6h-16.2
        v27.5H755.9z"/>
    </svg>
  </div>

  <section id="en" lang="en">
    <h1>Evaluation period has ended</h1>
    <p class="lede">
      This CloudHub evaluation expired on <span class="date">{{EXPIRED_ON}}</span>.<br>
      To keep using the service, please get in touch with us.
    </p>
    <div class="contacts">
      <article>
        <p class="role">Sales</p>
        <p class="name">Kyungyong Kim <span>Manager</span></p>
        <dl>
          <dt>Mobile</dt>
          <dd><a href="tel:+821054779150">010-5477-9150</a></dd>
          <dt>Email</dt>
          <dd><a href="mailto:kyungyong.kim@goodussolution.com">kyungyong.kim@goodussolution.com</a></dd>
        </dl>
      </article>
      <article>
        <p class="role">Technical</p>
        <p class="name">Yongsik Lee <span>General Manager</span></p>
        <dl>
          <dt>Mobile</dt>
          <dd><a href="tel:+821091660275">010-9166-0275</a></dd>
          <dt>Email</dt>
          <dd><a href="mailto:yongsik.lee@snetsystems.co.kr">yongsik.lee@snetsystems.co.kr</a></dd>
        </dl>
      </article>
    </div>
  </section>

  <section id="ko" lang="ko">
    <h1>평가 기간이 종료되었습니다</h1>
    <p class="lede">
      이 CloudHub 평가판은 <span class="date">{{EXPIRED_ON}}</span>에 만료되었습니다.<br>
      계속 이용하시려면 아래 담당자에게 문의해 주세요.
    </p>
    <div class="contacts">
      <article>
        <p class="role">영업 담당</p>
        <p class="name">김경용 <span>과장</span></p>
        <dl>
          <dt>Mobile</dt>
          <dd><a href="tel:+821054779150">010-5477-9150</a></dd>
          <dt>Email</dt>
          <dd><a href="mailto:kyungyong.kim@goodussolution.com">kyungyong.kim@goodussolution.com</a></dd>
        </dl>
      </article>
      <article>
        <p class="role">기술 담당</p>
        <p class="name">이용식 <span>부장</span></p>
        <dl>
          <dt>Mobile</dt>
          <dd><a href="tel:+821091660275">010-9166-0275</a></dd>
          <dt>Email</dt>
          <dd><a href="mailto:yongsik.lee@snetsystems.co.kr">yongsik.lee@snetsystems.co.kr</a></dd>
        </dl>
      </article>
    </div>
  </section>

  <nav>
    <a href="#ko">한국어</a>
    <a href="#en">English</a>
  </nav>
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

	expiredOn := expiresAt.Format(ExpiryDateLayout)
	notice := strings.ReplaceAll(expiryNoticeHTML, expiryDatePlaceholder, expiredOn)
	notice = strings.ReplaceAll(notice, snetMarkPlaceholder, snetSymbolPNG)

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
				expiredOn)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusForbidden)
		fmt.Fprint(w, notice)
	})
}
