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

const MarkdownCodeBlock: FC<{value?: string; language?: string}> = ({value, language}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const codeString = value || ''
  const lang = language || 'text'

  const handleCopyCode = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeString).catch(() => {})
      }
    } catch {
      // Fallback ignore clipboard errors in non-secure or iframe contexts
    }
    setIsCopied(true)
    setTimeout(() => {
      setIsCopied(false)
    }, 2000)
  }

  return (
    <div className="chat-markdown-codeblock">
      <div className="codeblock-header">
        <span className="codeblock-lang">{lang.toUpperCase()}</span>
        <button
          className="codeblock-copy-btn"
          onClick={handleCopyCode}
          type="button"
        >
          {isCopied ? '✓ Copied' : 'Copy Code'}
        </button>
      </div>
      <pre className="codeblock-pre">
        <code>{codeString}</code>
      </pre>
    </div>
  )
}

const MarkdownImage: FC<{src?: string; alt?: string}> = ({src, alt}) => {
  const [hasError, setHasError] = useState<boolean>(false)

  if (hasError || !src) {
    return (
      <span className="chat-markdown-img-fallback">
        🖼️ <strong>Image Path:</strong> <code>{src || 'Unknown'}</code>
      </span>
    )
  }

  return (
    <span className="chat-markdown-image-container">
      <img
        src={src}
        alt={alt || 'Attached image'}
        className="chat-markdown-img"
        onError={() => setHasError(true)}
      />
      {alt && alt !== 'Pasted Image' && alt !== 'Attached image' && (
        <span className="chat-markdown-img-caption">{alt}</span>
      )}
    </span>
  )
}

const MarkdownLink: FC<{href?: string; children?: React.ReactNode}> = ({href, children}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="chat-markdown-link"
  >
    {children}
  </a>
)

const MarkdownTableCell: FC<{isHeader?: boolean; children?: React.ReactNode}> = ({isHeader, children}) => {
  if (isHeader) {
    return <th>{children}</th>
  }
  return <td>{children}</td>
}

export const AiChatMessageMarkdown: FC<AiChatMessageMarkdownProps> = ({
  content,
  className,
}) => {
  const processedContent = preprocessMarkdownText(typeof content === 'string' ? content : String(content || ''))

  return (
    <div className={classnames('chat-markdown-body', className)}>
      <Markdown
        source={processedContent}
        renderers={{
          code: MarkdownCodeBlock,
          image: MarkdownImage,
          link: MarkdownLink,
          tableCell: MarkdownTableCell,
        }}
        escapeHtml={false}
      />
    </div>
  )
}

export default AiChatMessageMarkdown
