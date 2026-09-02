import React, {FC, useState} from 'react'
import classnames from 'classnames'

import AiChatBadge from 'src/ai_chat/components/AiChatBadge'
import {ActivityCardItem} from 'src/ai_chat/containers/CloudhubAiChatStandalone'

const ensureString = (val: any): string => {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }
  return String(val)
}

const MAX_TOOL_OUTPUT_DISPLAY_CHARS = 50000

const SafeLargeTextPre: FC<{
  title: string
  content: string
  isError?: boolean
}> = ({title, content, isError}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const isTruncated = content.length > MAX_TOOL_OUTPUT_DISPLAY_CHARS
  const displayContent = isTruncated
    ? content.slice(0, MAX_TOOL_OUTPUT_DISPLAY_CHARS)
    : content

  const handleCopy = () => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        navigator.clipboard.writeText(content).catch(() => {})
      }
    } catch {
      // ignore
    }
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div
      className={classnames('activity-detail-block', {'error-block': isError})}
    >
      <div className="detail-header-row">
        <span className="detail-title">{title}</span>
        <button
          type="button"
          className="detail-copy-btn"
          onClick={handleCopy}
          title="전체 원본 클립보드 복사"
        >
          {isCopied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <pre className={classnames('detail-pre', {'error-pre': isError})}>
        <code>{displayContent}</code>
      </pre>
      {isTruncated && (
        <div className="detail-truncation-notice">
          대용량 로그입니다. 브라우저 성능을 위해 총{' '}
          {content.length.toLocaleString()}자 중{' '}
          {MAX_TOOL_OUTPUT_DISPLAY_CHARS.toLocaleString()}자만 표시되었습니다.
          (전체 내용은 '복사' 버튼으로 확인 가능)
        </div>
      )}
    </div>
  )
}

export const AiChatToolExecutionCard: FC<{card: ActivityCardItem}> = ({
  card,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  if (!card) return null

  const labelText = ensureString(card.label) || 'Tool'
  const descriptionText = ensureString(card.description)
  const inputText = ensureString(card.input)
  const detailText = ensureString(card.detail)
  const errorText = ensureString(card.error)

  const startedAt = card.startedAt ? Number(card.startedAt) : null
  const endedAt = card.endedAt ? Number(card.endedAt) : null

  const durationMs =
    startedAt && endedAt && endedAt >= startedAt ? endedAt - startedAt : null

  const durationText =
    durationMs !== null
      ? durationMs < 1000
        ? `${durationMs}ms`
        : `${(durationMs / 1000).toFixed(2)}s`
      : null

  const rawStatus = card.status || 'success'
  const badgeClass = rawStatus.toLowerCase()
  const badgeLabel =
    rawStatus === 'running'
      ? '실행 중...'
      : rawStatus === 'success'
      ? '완료'
      : rawStatus === 'error'
      ? '오류'
      : '차단됨'

  const hasDetails = Boolean(
    inputText || detailText || errorText || durationText
  )

  return (
    <div className={classnames('activity-card-box', badgeClass)}>
      <div className="activity-card-header">
        <div className="activity-card-title">
          <AiChatBadge variant="category" size="sm">
            {card.type === 'mcp' ? 'MCP' : 'TOOL'}
          </AiChatBadge>
          <span className="activity-label">{labelText}</span>
        </div>
        <AiChatBadge variant={badgeClass} size="sm">
          {badgeLabel}
        </AiChatBadge>
      </div>

      {descriptionText && (
        <div className="activity-card-description">{descriptionText}</div>
      )}

      {hasDetails && (
        <div className="activity-card-footer">
          <button
            type="button"
            className="activity-card-toggle-btn"
            onClick={() => setIsExpanded(prev => !prev)}
          >
            {isExpanded ? '▲ 접기' : '▼ [입력 / 출력 / 실행 시간 보기]'}
          </button>
          {durationText && (
            <span className="activity-duration">{durationText}</span>
          )}
        </div>
      )}

      {isExpanded && hasDetails && (
        <div className="activity-card-expanded">
          {inputText && (
            <SafeLargeTextPre title="입력 (Input):" content={inputText} />
          )}
          {detailText && (
            <SafeLargeTextPre title="출력 (Output):" content={detailText} />
          )}
          {errorText && (
            <SafeLargeTextPre
              title="오류 (Error):"
              content={errorText}
              isError={true}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default AiChatToolExecutionCard
