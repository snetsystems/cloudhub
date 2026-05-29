import React, {useEffect, useRef} from 'react'

interface MockData {
  level: string
  message: string
  host: string
  time: string
  id: string
}

interface Props {
  html: string
  mock: MockData
  className?: string
  style?: React.CSSProperties
}

// Substitute Kapacitor TICK template placeholders with mock values so the
// preview shows realistic content instead of raw `{{ .Level }}` text.
// Patterns covered:
//   {{ .Level }}                    → mock.level
//   {{ .Message }}                  → mock.message
//   {{ .Time }}                     → mock.time
//   {{ .ID }}                       → mock.id
//   {{ index .Tags "host" }}        → mock.host
// Whitespace inside the braces is tolerated.
function renderLevelConditionals(html: string, level: string): string {
  const conditional = /\{\{\s*if\s+eq\s+\.Level\s+"([^"]+)"\s*\}\}([\s\S]*?)(?:\{\{\s*else\s+if\s+eq\s+\.Level\s+"([^"]+)"\s*\}\}([\s\S]*?))?(?:\{\{\s*else\s*\}\}([\s\S]*?))?\{\{\s*end\s*\}\}/g

  return html.replace(
    conditional,
    (_match, firstLevel, firstValue, secondLevel, secondValue, fallback) => {
      if (level === firstLevel) {
        return firstValue
      }
      if (secondLevel && level === secondLevel) {
        return secondValue
      }
      return fallback || ''
    }
  )
}

export function substituteEmailBodyTemplate(
  html: string,
  mock: MockData
): string {
  html = renderLevelConditionals(html, mock.level)
  const rules: Array<[RegExp, string]> = [
    [/\{\{\s*\.Level\s*\}\}/g, mock.level],
    [/\{\{\s*\.Message\s*\}\}/g, mock.message],
    [/\{\{\s*\.Time\s*\}\}/g, mock.time],
    [/\{\{\s*\.ID\s*\}\}/g, mock.id],
    [/\{\{\s*index\s+\.Tags\s+"host"\s*\}\}/g, mock.host],
  ]
  return rules.reduce((acc, [re, val]) => acc.replace(re, val), html)
}

// EmailBodyPreview renders an HTML email body inside a Shadow DOM so the
// parent app's CSS does not leak in (and vice versa). The body element's
// inline `style` attribute is preserved on the shadow root's host wrapper —
// without this, page-level styles like background and font-family would be
// lost because the browser strips `<html>` / `<body>` when injected as a
// fragment.
const EmailBodyPreview: React.FC<Props> = ({html, mock, className, style}) => {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const rendered = substituteEmailBodyTemplate(html, mock)
    const doc = new DOMParser().parseFromString(rendered, 'text/html')
    const body = doc.body
    const bodyStyle = body?.getAttribute('style') ?? ''
    const bodyInner = body?.innerHTML ?? ''

    const shadow = host.shadowRoot ?? host.attachShadow({mode: 'open'})
    shadow.innerHTML = `<div style="${bodyStyle}">${bodyInner}</div>`
  }, [html, mock])

  return <div ref={hostRef} className={className} style={style} />
}

export default EmailBodyPreview
