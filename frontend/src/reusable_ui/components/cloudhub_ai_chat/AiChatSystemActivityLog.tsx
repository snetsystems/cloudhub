import React, {FC, useState} from 'react'
import classnames from 'classnames'

export type SystemActivityType = 'skill' | 'mcp' | 'tool' | 'security'
export type SystemActivityStatus = 'success' | 'error' | 'running' | 'blocked'

export interface SystemActivityEntry {
  id: string
  type: SystemActivityType
  label: string
  description?: string
  input?: string        // 도구 입력 인자 (Input Arguments)
  detail?: string       // 도구 출력 결과 (Output Result)
  truncated?: boolean   // Output 캡핑 절단 여부 (Preview Mode)
  error?: string        // 도구 실행 오류 메시지
  status?: SystemActivityStatus
}

export const formatJsonOrText = (input?: string): string => {
  if (!input) return ''
  const trimmed = input.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(trimmed)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return input
    }
  }
  return input
}

const TYPE_LABEL: Record<SystemActivityType, string> = {
  skill: 'Skill',
  mcp: 'MCP',
  tool: 'Tool',
  security: 'Security',
}

const STATUS_LABEL: Record<SystemActivityStatus, string> = {
  success: '완료',
  error: '실패',
  running: '실행 중',
  blocked: '차단됨',
}

// Line-art glyphs kept distinct per activity type so entries stay scannable
// without relying on decorative emoji.
const TYPE_GLYPH: Record<SystemActivityType, (size: number) => React.ReactNode> = {
  skill: size => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M9.4 4.6a1.9 1.9 0 013.2 1.5v.4a1.4 1.4 0 001.4 1.4h.4a1.9 1.9 0 011.5 3.2 1.9 1.9 0 01-1.5 3.2h-.4a1.4 1.4 0 00-1.4 1.4v.4a1.9 1.9 0 11-3.8 0v-.4a1.4 1.4 0 00-1.4-1.4h-.4a1.9 1.9 0 010-3.8h.4A1.4 1.4 0 009 9.1v-.4a1.9 1.9 0 01.4-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  mcp: size => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <rect x="3.5" y="4.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="12.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 11.5v3a2 2 0 002 2h3.5M17 11.5v-3a2 2 0 00-2-2H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  tool: size => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M14.7 4.3a4 4 0 00-5 4.9L4 15l1.6 1.6L6 15l1.4 1.4L6 18l1.6 1.6 5.7-5.7a4 4 0 004.9-5 3.9 3.9 0 01-1.7 2.1l-2.2-2.2A3.9 3.9 0 0016.8 6a3.9 3.9 0 01-2.1-1.7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  ),
  security: size => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M12 3.5l7 2.7v5.3c0 4.4-2.9 7.9-7 9-4.1-1.1-7-4.6-7-9V6.2l7-2.7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

const ChevronGlyph: FC<{expanded: boolean}> = ({expanded}) => (
  <svg
    viewBox="0 0 24 24"
    width="11"
    height="11"
    fill="none"
    className={classnames('activity-log-chevron', {expanded})}
  >
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface ActivityEntryItemProps {
  entry: SystemActivityEntry
  iconSize: number
  showIcon?: boolean
}

const ActivityEntryItem: FC<ActivityEntryItemProps> = ({entry, iconSize, showIcon = true}) => {
  const [isItemExpanded, setIsItemExpanded] = useState<boolean>(false)
  const hasDetails = Boolean(entry.input || entry.detail || entry.error)

  const handleToggle = () => {
    if (hasDetails) {
      setIsItemExpanded(prev => !prev)
    }
  }

  return (
    <li
      className={classnames(
        'activity-entry',
        `type-${entry.type}`,
        entry.status && `status-${entry.status}`,
        {
          clickable: hasDetails,
          expanded: isItemExpanded,
        }
      )}
      onClick={handleToggle}
    >
      {showIcon && (
        <span className="activity-entry-icon">{TYPE_GLYPH[entry.type](iconSize)}</span>
      )}
      <div className="activity-entry-body">
        <div className="activity-entry-title-row">
          <span className="activity-entry-type-tag">{TYPE_LABEL[entry.type]}</span>
          <span className="activity-entry-label">{entry.label}</span>
          {entry.truncated && (
            <span className="activity-truncated-badge">[Preview Mode - Capped at 16KB]</span>
          )}
          {hasDetails && (
            <span className="activity-entry-expand-hint">
              <ChevronGlyph expanded={isItemExpanded} />
            </span>
          )}
        </div>
        {entry.description && (
          <div className="activity-entry-desc">{entry.description}</div>
        )}
        {!isItemExpanded && entry.detail && !entry.input && (
          <code className="activity-entry-detail">{entry.detail}</code>
        )}
        {isItemExpanded && (
          <div className="activity-entry-details-container" onClick={e => e.stopPropagation()}>
            {entry.input && (
              <div className="activity-entry-input-block">
                <div className="activity-block-label">Input Arguments</div>
                <pre className="activity-code-block">{formatJsonOrText(entry.input)}</pre>
              </div>
            )}
            {entry.detail && (
              <div className="activity-entry-output-block">
                <div className="activity-block-header">
                  <span className="activity-block-label">Output Result</span>
                  {entry.truncated && (
                    <span className="activity-truncated-badge">[Preview Mode - Capped at 16KB]</span>
                  )}
                </div>
                <pre className="activity-code-block">{entry.detail}</pre>
              </div>
            )}
            {entry.error && (
              <div className="activity-entry-error-block">
                <div className="activity-block-label error-label">Execution Error</div>
                <pre className="activity-code-block error-text">{entry.error}</pre>
              </div>
            )}
          </div>
        )}
      </div>
      {entry.status && (
        <span className={classnames('activity-entry-status-badge', entry.status)}>
          {entry.status === 'running' && <span className="activity-spinner" />}
          {entry.status === 'success' && <span className="status-icon">✓</span>}
          {entry.status === 'error' && <span className="status-icon">✕</span>}
          <span className="status-text">{STATUS_LABEL[entry.status]}</span>
        </span>
      )}
    </li>
  )
}

interface ActivityEntryListProps {
  entries: SystemActivityEntry[]
  iconSize: number
  showIcon?: boolean
}

const ActivityEntryList: FC<ActivityEntryListProps> = ({entries, iconSize, showIcon = true}) => (
  <ul className="activity-entry-list">
    {entries.map(entry => (
      <ActivityEntryItem key={entry.id} entry={entry} iconSize={iconSize} showIcon={showIcon} />
    ))}
  </ul>
)

interface AiChatSystemActivityLogProps {
  title?: string
  entries: SystemActivityEntry[]
  className?: string
}

/**
 * Compact, collapsed-by-default log of system/gateway-level processing for a
 * chat turn (e.g. secret masking, blocked actions). This is passive policy
 * info an admin trusts is happening — a title + count is enough, details are
 * one click away. Contrast with AiChatToolExecutionLog below, which is the
 * always-visible audit trail of actions the AI actually took.
 */
export const AiChatSystemActivityLog: FC<AiChatSystemActivityLogProps> = ({
  title = '시스템 처리내역',
  entries,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  if (!entries || entries.length === 0) return null

  return (
    <div className={classnames('activity-log', 'activity-log-system', {expanded: isExpanded}, className)}>
      <button
        type="button"
        className="activity-log-header"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
      >
        <ChevronGlyph expanded={isExpanded} />
        <span className="activity-log-title">{title}</span>
        <span className="activity-log-count">{entries.length}</span>
      </button>
      {isExpanded && <ActivityEntryList entries={entries} iconSize={13} showIcon={false} />}
    </div>
  )
}

/**
 * Always-expanded log of skills, MCP tools, and other commands the AI ran on
 * the server for this turn. This is the record a server admin actually came
 * here to verify, so it is never hidden behind a click, and icons are sized
 * up so the tool/skill in use is identifiable at a glance.
 */
export const AiChatToolExecutionLog: FC<AiChatSystemActivityLogProps> = ({
  title = 'AI 실행 내역 (Skill · Tool · MCP)',
  entries,
  className,
}) => {
  if (!entries || entries.length === 0) return null

  return (
    <div className={classnames('activity-log', 'activity-log-tools', className)}>
      <div className="activity-log-header">
        <span className="activity-log-title">{title}</span>
        <span className="activity-log-count">{entries.length}</span>
      </div>
      <ActivityEntryList entries={entries} iconSize={19} />
    </div>
  )
}

export default AiChatSystemActivityLog
