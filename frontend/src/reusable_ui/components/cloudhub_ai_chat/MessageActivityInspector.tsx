import React, {FC, useState, useMemo} from 'react'
import classnames from 'classnames'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import RadioButtons from 'src/reusable_ui/components/radio_buttons/RadioButtons'
import AiChatBadge from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatBadge'
import {ActivityCardItem} from 'src/reusable_ui/components/cloudhub_ai_chat/CloudhubAiChatStandalone'

export interface ConversationTurnItem {
  id: string
  userPrompt?: string
  aiResponse?: string
  timestamp?: string
  activities?: ActivityCardItem[]
  toolCommand?: string
  isStreaming?: boolean
}

export interface MessageActivityInspectorProps {
  turns?: ConversationTurnItem[]
  selectedTurnId?: string | null
  onSelectTurnId?: (id: string) => void
  onClose?: () => void
}

const MAX_DISPLAY_CHARS = 4000

const ensureString = (val: any): string => {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2)
    } catch {
      return '[Complex Object]'
    }
  }
  return String(val)
}

const ActivityItemRow: FC<{activity: ActivityCardItem; defaultExpanded?: boolean}> = ({
  activity,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const label = ensureString(activity.label) || 'Tool Execution'
  const description = ensureString(activity.description)
  const input = ensureString(activity.input)
  const detail = ensureString(activity.detail)
  const error = ensureString(activity.error)

  const startedAt = activity.startedAt ? Number(activity.startedAt) : null
  const endedAt = activity.endedAt ? Number(activity.endedAt) : null
  const durationMs =
    startedAt && endedAt && endedAt >= startedAt ? endedAt - startedAt : null
  const durationText =
    durationMs !== null
      ? durationMs < 1000
        ? `${durationMs}ms`
        : `${(durationMs / 1000).toFixed(2)}s`
      : null

  const status = activity.status || 'success'
  const statusBadgeVariant =
    status === 'running'
      ? 'running'
      : status === 'success'
      ? 'done'
      : status === 'error'
      ? 'error'
      : 'blocked'

  const statusLabel =
    status === 'running'
      ? '실행 중'
      : status === 'success'
      ? '완료'
      : status === 'error'
      ? '오류'
      : '차단됨'

  const hasDetails = Boolean(input || detail || error)

  const handleCopy = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className={classnames('activity-inspector-card', status)}>
      <div
        className="activity-card-top"
        onClick={() => hasDetails && setIsExpanded(prev => !prev)}
      >
        <div className="activity-card-main-info">
          <AiChatBadge variant="category" size="sm">
            {activity.type === 'mcp' ? 'MCP' : 'TOOL'}
          </AiChatBadge>
          <span className="activity-name-text" title={label}>
            {label}
          </span>
        </div>
        <div className="activity-card-meta-right">
          {durationText && (
            <span className="activity-time-duration">{durationText}</span>
          )}
          <AiChatBadge variant={statusBadgeVariant} size="sm">
            {statusLabel}
          </AiChatBadge>
          {hasDetails && (
            <button
              type="button"
              className="toggle-expand-btn"
              onClick={e => {
                e.stopPropagation()
                setIsExpanded(prev => !prev)
              }}
              title={isExpanded ? '접기' : '펼치기'}
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {description && (
        <div className="activity-card-desc-row">{description}</div>
      )}

      {isExpanded && hasDetails && (
        <div className="activity-card-body-details">
          {input && (
            <div className="detail-block input-block">
              <div className="detail-header-row">
                <span className="detail-title">입력 파라미터 (Input)</span>
                <button
                  type="button"
                  className="detail-copy-btn"
                  onClick={() => handleCopy(input, 'input')}
                >
                  {copiedKey === 'input' ? '✓ 복사됨' : '복사'}
                </button>
              </div>
              <pre className="detail-pre-code">{input.slice(0, MAX_DISPLAY_CHARS)}</pre>
            </div>
          )}

          {detail && (
            <div className="detail-block output-block">
              <div className="detail-header-row">
                <span className="detail-title">실행 결과 (Output)</span>
                <button
                  type="button"
                  className="detail-copy-btn"
                  onClick={() => handleCopy(detail, 'output')}
                >
                  {copiedKey === 'output' ? '✓ 복사됨' : '복사'}
                </button>
              </div>
              <pre className="detail-pre-code">{detail.slice(0, MAX_DISPLAY_CHARS)}</pre>
            </div>
          )}

          {error && (
            <div className="detail-block error-block">
              <div className="detail-header-row">
                <span className="detail-title">에러 메시지 (Error)</span>
                <button
                  type="button"
                  className="detail-copy-btn"
                  onClick={() => handleCopy(error, 'error')}
                >
                  {copiedKey === 'error' ? '✓ 복사됨' : '복사'}
                </button>
              </div>
              <pre className="detail-pre-code">{error.slice(0, MAX_DISPLAY_CHARS)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const MessageActivityInspector: FC<MessageActivityInspectorProps> = ({
  turns = [],
  selectedTurnId,
  onSelectTurnId,
  onClose,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'running' | 'success' | 'error'>('ALL')

  const activeTurn = useMemo(() => {
    if (selectedTurnId) {
      const found = turns.find(t => t.id === selectedTurnId)
      if (found) return found
    }
    return turns.length > 0 ? turns[turns.length - 1] : null
  }, [turns, selectedTurnId])

  const activities = activeTurn?.activities || []

  const filteredActivities = useMemo(() => {
    if (filter === 'ALL') return activities
    return activities.filter(a => a.status === filter)
  }, [activities, filter])

  const counts = useMemo(() => {
    const running = activities.filter(a => a.status === 'running').length
    const success = activities.filter(a => a.status === 'success').length
    const error = activities.filter(a => a.status === 'error').length
    return {all: activities.length, running, success, error}
  }, [activities])

  return (
    <div className="message-activity-inspector">
      <div className="activity-inspector-layout">
        {/* Left Sidebar: List of Conversation Turns */}
        <div className="turn-menu-sidebar">
          <div className="turn-menu-header">
            <span className="sidebar-header-title">대화 내역</span>
            <AiChatBadge variant="category" size="sm">
              {turns.length} Turns
            </AiChatBadge>
          </div>
          <div className="turn-list-scroll-wrapper">
            <FancyScrollbar autoHide={true}>
              <div className="turn-list-container">
                {turns.length === 0 ? (
                  <div className="turn-list-empty">대화 내역이 없습니다.</div>
                ) : (
                  turns.map((turn, index) => {
                    const isSelected = activeTurn?.id === turn.id
                    const toolCount = turn.activities?.length || 0
                    const hasError = turn.activities?.some(a => a.status === 'error')
                    const isRunning = turn.activities?.some(a => a.status === 'running')

                    const userText = turn.userPrompt || '질문 내용 없음'
                    const aiText =
                      turn.aiResponse ||
                      (turn.isStreaming ? '답변 생성 중...' : '도구 실행 중...')

                    return (
                      <div
                        key={turn.id || `turn-${index}`}
                        className={classnames('turn-list-card', {
                          active: isSelected,
                        })}
                        onClick={() => onSelectTurnId && onSelectTurnId(turn.id)}
                      >
                        <div className="turn-card-top">
                          <span className="turn-badge">Turn #{index + 1}</span>
                          {turn.timestamp && (
                            <span className="turn-timestamp">{turn.timestamp}</span>
                          )}
                        </div>

                        <div className="turn-user-query" title={userText}>
                          <span className="q-tag">Q.</span> {userText}
                        </div>

                        <div className="turn-ai-snippet" title={aiText}>
                          <span className="a-tag">A.</span> {aiText}
                        </div>

                        <div className="turn-card-footer">
                          {toolCount > 0 ? (
                            <AiChatBadge variant="category" size="sm">
                              도구 {toolCount}개
                            </AiChatBadge>
                          ) : (
                            <span className="no-tool-label">대화만</span>
                          )}

                          {isRunning && (
                            <AiChatBadge variant="running" size="sm">
                              실행 중
                            </AiChatBadge>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </FancyScrollbar>
          </div>
        </div>

        {/* Right Detail Pane: Tool execution and diagnostics */}
        <div className="turn-detail-pane">
          <div className="activity-inspector-header">
            <div className="inspector-header-left">
              <div className="inspector-header-titles">
                <div className="inspector-main-title">도구 및 스킬 실행 상세</div>
                <div
                  className="inspector-sub-snippet"
                  title={activeTurn?.userPrompt || activeTurn?.aiResponse}
                >
                  {activeTurn?.userPrompt
                    ? `Q: ${activeTurn.userPrompt}`
                    : activeTurn?.aiResponse
                    ? `A: ${activeTurn.aiResponse}`
                    : '선택된 대화 턴'}
                </div>
              </div>
            </div>
            <div className="inspector-header-right">
              {activeTurn?.timestamp && (
                <span className="inspector-timestamp">
                  {activeTurn.timestamp}
                </span>
              )}
              {onClose && (
                <button
                  type="button"
                  className="close-inspector-btn"
                  onClick={onClose}
                  title="패널 닫기"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="activity-inspector-filter-bar">
            <div className="radio-buttons radio-buttons--default radio-buttons--sm">
              {[
                {key: 'ALL', label: `전체 (${counts.all})`},
                {key: 'running', label: `진행 중 (${counts.running})`},
                {key: 'success', label: `완료 (${counts.success})`},
                {key: 'error', label: `오류 (${counts.error})`},
              ].map(f => (
                <RadioButtons.Button
                  key={f.key}
                  id={`filter-${f.key}`}
                  active={filter === f.key}
                  value={f.key}
                  onClick={() => setFilter(f.key as any)}
                  titleText={`${f.label} 필터`}
                >
                  {f.label}
                </RadioButtons.Button>
              ))}
            </div>
          </div>

          <div className="activity-inspector-scroll-area">
            <FancyScrollbar autoHide={true}>
              <div className="activity-inspector-content">
                {activeTurn?.toolCommand &&
                  activeTurn.toolCommand !== 'NONE (BLOCKED BY GATEWAY)' && (
                    <div className="executed-command-card">
                      <div className="card-label">터미널 실행 명령어 (CLI Command)</div>
                      <pre className="command-pre">
                        <code>{activeTurn.toolCommand}</code>
                      </pre>
                    </div>
                  )}

                {filteredActivities.length === 0 ? (
                  <div className="activity-inspector-empty">
                    <div className="empty-title">
                      {counts.all === 0
                        ? '도구(Tool) 실행 내역이 없습니다'
                        : '조건에 해당하는 도구 실행 내역이 없습니다'}
                    </div>
                    <div className="empty-sub">
                      {counts.all === 0
                        ? '이 대화 턴에서는 추가적인 외부 도구나 MCP를 호출하지 않고 답변을 생성했습니다.'
                        : '다른 필터를 선택하여 완료/오류 내역을 확인하세요.'}
                    </div>
                  </div>
                ) : (
                  <div className="activity-cards-list">
                    {filteredActivities.map((act, index) => (
                      <ActivityItemRow
                        key={act.id || `act-${index}`}
                        activity={act}
                        defaultExpanded={index === 0 || act.status === 'error'}
                      />
                    ))}
                  </div>
                )}
              </div>
            </FancyScrollbar>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MessageActivityInspector
