import React, {FC, useState} from 'react'
import Markdown from 'react-markdown'
import classnames from 'classnames'

interface AiChatMessageMarkdownProps {
  content: string
  className?: string
}

/**
 * Pre-processes text to nicely format special patterns like:
 * - [Pasted text #1 +26 lines] -> formatted quote/chip
 * - Raw local file paths (/tmp/orca-paste-xxx.png) -> formatted attached file badge/card
 *   (Strictly avoids corrupting http:// or https:// URLs)
 */
const preprocessMarkdownText = (rawText: string): string => {
  if (!rawText) return ''

  let processed = rawText

  // 1. Format pasted text chips like [Pasted text #1 +26 lines]
  const pastedTextRegex = /\[Pasted text (#\d+) (\+\d+ lines)\]/g
  processed = processed.replace(pastedTextRegex, '`📋 Pasted text $1 ($2)`')

  // 2. Format isolated local temp file paths (e.g. /tmp/orca-paste-xxx.png)
  // Ensures http:// or https:// URLs are NEVER matched or corrupted
  const localTempPathRegex = /(?<!https?:\/\/[^\s\)]*)(?<![a-zA-Z0-9_\-\/])(\/(?:tmp|var|home|Users|[a-zA-Z0-9_\-\.]+)\/[^\s\)]+\.(?:png|jpg|jpeg|gif|svg|webp))/gi

  processed = processed.replace(localTempPathRegex, (match, capturedPath, offset, fullString) => {
    // Safety check: ensure not preceded by protocol like http: or https:
    const prefix = fullString.substring(Math.max(0, offset - 10), offset)
    if (/https?:$/i.test(prefix) || /:\/$/i.test(prefix) || /:\/\/$!/i.test(prefix)) {
      return match
    }
    return `\`🖼️ Attached Image Path: ${capturedPath}\``
  })

  return processed
}

export const AiChatMessageMarkdown: FC<AiChatMessageMarkdownProps> = ({
  content,
  className,
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  const handleCopyCode = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText)
    setCopiedCodeId(id)
    setTimeout(() => {
      setCopiedCodeId(null)
    }, 2000)
  }

  const processedContent = preprocessMarkdownText(content)

  // Custom Code Block component for react-markdown 3.x
  const renderCodeBlock = (props: {value?: string; language?: string}) => {
    const codeString = props.value || ''
    const lang = props.language || 'text'
    const codeId = `code-${Math.random().toString(36).substring(2, 9)}`

    return (
      <div className="chat-markdown-codeblock">
        <div className="codeblock-header">
          <span className="codeblock-lang">{lang.toUpperCase()}</span>
          <button
            className="codeblock-copy-btn"
            onClick={() => handleCopyCode(codeString, codeId)}
            type="button"
          >
            {copiedCodeId === codeId ? '✓ Copied' : 'Copy Code'}
          </button>
        </div>
        <pre className="codeblock-pre">
          <code>{codeString}</code>
        </pre>
      </div>
    )
  }

  // Custom Image Renderer using inline-block container to prevent HTML DOM breaking inside <li> or <p>
  const renderImage = (props: {src?: string; alt?: string}) => {
    const [hasError, setHasError] = useState(false)

    if (hasError || !props.src) {
      return (
        <span className="chat-markdown-img-fallback">
          🖼️ <strong>Image Path:</strong> <code>{props.src || 'Unknown'}</code>
        </span>
      )
    }

    return (
      <span className="chat-markdown-image-container">
        <img
          src={props.src}
          alt={props.alt || 'Attached image'}
          className="chat-markdown-img"
          onError={() => setHasError(true)}
        />
        {props.alt && props.alt !== 'Pasted Image' && props.alt !== 'Attached image' && (
          <span className="chat-markdown-img-caption">{props.alt}</span>
        )}
      </span>
    )
  }

  // Custom Link Renderer
  const renderLink = (props: {href?: string; children?: React.ReactNode}) => {
    return (
      <a
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-markdown-link"
      >
        {props.children}
      </a>
    )
  }

  // Custom Table Cell Renderer
  const renderTableCell = (props: {isHeader?: boolean; children?: React.ReactNode}) => {
    if (props.isHeader) {
      return <th>{props.children}</th>
    }
    return <td>{props.children}</td>
  }

  return (
    <div className={classnames('chat-markdown-body', className)}>
      <Markdown
        source={processedContent}
        renderers={{
          code: renderCodeBlock,
          image: renderImage,
          link: renderLink,
          tableCell: renderTableCell,
        }}
        escapeHtml={false}
      />
    </div>
  )
}

export default AiChatMessageMarkdown
