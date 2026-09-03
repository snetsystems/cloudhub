import React, {FC, useState, useMemo} from 'react'
import classnames from 'classnames'
import {useTranslation} from 'react-i18next'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import RadioButtons from 'src/reusable_ui/components/radio_buttons/RadioButtons'
import AiChatBadge from 'src/ai_chat/components/AiChatBadge'
import {ActivityCardItem} from 'src/ai_chat/containers/CloudhubAiChatStandalone'

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
  const {t} = useTranslation()
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const label = ensureString(activity.label) || t('ai_chat.task.default_name')
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
      ? t('ai_chat.status.running')
      : status === 'success'
      ? t('ai_chat.status.success')
      : status === 'error'
      ? t('ai_chat.status.error')
      : t('ai_chat.status.blocked')

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
              title={
                isExpanded
                  ? t('ai_chat.inspector.collapse')
                  : t('ai_chat.inspector.expand')
              }
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
                <span className="detail-title">
                  {t('ai_chat.inspector.input_params')}
                </span>
                <button
                  type="button"
                  className="detail-copy-btn"
                  onClick={() => handleCopy(input, 'input')}
                >
                  {copiedKey === 'input'
                    ? t('ai_chat.inspector.copied')
                    : t('ai_chat.inspector.copy')}
                </button>
              </div>
              <pre className="detail-pre-code">{input.slice(0, MAX_DISPLAY_CHARS)}</pre>
            </div>
          )}

          {detail && (
            <div className="detail-block output-block">
              <div className="detail-header-row">
                <span className="detail-title">
                  {t('ai_chat.inspector.output_result')}
                </span>
                <button
                  type="button"
                  className="detail-copy-btn"
                  onClick={() => handleCopy(detail, 'output')}
                >
                  {copiedKey === 'output'
                    ? t('ai_chat.inspector.copied')
                    : t('ai_chat.inspector.copy')}
                </button>
              </div>
              <pre className="detail-pre-code">{detail.slice(0, MAX_DISPLAY_CHARS)}</pre>
            </div>
          )}

          {error && (
            <div className="detail-block error-block">
              <div className="detail-header-row">
                <span className="detail-title">
                  {t('ai_chat.inspector.error_message')}
                </span>
                <button
                  type="button"
                  className="detail-copy-btn"
                  onClick={() => handleCopy(error, 'error')}
                >
                  {copiedKey === 'error'
                    ? t('ai_chat.inspector.copied')
                    : t('ai_chat.inspector.copy')}
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
  const {t} = useTranslation()
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
            <span className="sidebar-header-title">
              {t('ai_chat.inspector.turn_list_title')}
            </span>
            <AiChatBadge variant="category" size="sm">
              {t('ai_chat.inspector.turns', {count: turns.length})}
            </AiChatBadge>
          </div>
          <div className="turn-list-scroll-wrapper">
            <FancyScrollbar autoHide={true}>
              <div className="turn-list-container">
                {turns.length === 0 ? (
                  <div className="turn-list-empty">
                    {t('ai_chat.inspector.turn_list_empty')}
                  </div>
                ) : (
                  turns.map((turn, index) => {
                    const isSelected = activeTurn?.id === turn.id
                    const toolCount = turn.activities?.length || 0
                    const hasError = turn.activities?.some(a => a.status === 'error')
                    const isRunning = turn.activities?.some(a => a.status === 'running')

                    const userText =
                      turn.userPrompt || t('ai_chat.inspector.no_question')
                    const aiText =
                      turn.aiResponse ||
                      (turn.isStreaming
                        ? t('ai_chat.inspector.answer_streaming')
                        : t('ai_chat.inspector.tools_running'))

                    return (
                      <div
                        key={turn.id || `turn-${index}`}
                        className={classnames('turn-list-card', {
                          active: isSelected,
                        })}
                        onClick={() => onSelectTurnId && onSelectTurnId(turn.id)}
                      >
                        <div className="turn-card-top">
                          <span className="turn-badge">
                            {t('ai_chat.inspector.turn_badge', {
                              number: index + 1,
                            })}
                          </span>
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
                              {t('ai_chat.inspector.tool_count', {
                                count: toolCount,
                              })}
                            </AiChatBadge>
                          ) : (
                            <span className="no-tool-label">
                              {t('ai_chat.inspector.chat_only')}
                            </span>
                          )}

                          {isRunning && (
                            <AiChatBadge variant="running" size="sm">
                              {t('ai_chat.status.running')}
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
                <div className="inspector-main-title">
                  {t('ai_chat.inspector.detail_title')}
                </div>
                <div
                  className="inspector-sub-snippet"
                  title={activeTurn?.userPrompt || activeTurn?.aiResponse}
                >
                  {activeTurn?.userPrompt
                    ? `Q: ${activeTurn.userPrompt}`
                    : activeTurn?.aiResponse
                    ? `A: ${activeTurn.aiResponse}`
                    : t('ai_chat.inspector.no_turn_selected')}
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
                  title={t('ai_chat.inspector.close')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="activity-inspector-filter-bar">
            <div className="radio-buttons radio-buttons--default radio-buttons--sm">
              {[
                {
                  key: 'ALL',
                  label: t('ai_chat.inspector.filter.all', {total: counts.all}),
                },
                {
                  key: 'running',
                  label: t('ai_chat.inspector.filter.running', {
                    total: counts.running,
                  }),
                },
                {
                  key: 'success',
                  label: t('ai_chat.inspector.filter.success', {
                    total: counts.success,
                  }),
                },
                {
                  key: 'error',
                  label: t('ai_chat.inspector.filter.error', {
                    total: counts.error,
                  }),
                },
              ].map(f => (
                <RadioButtons.Button
                  key={f.key}
                  id={`filter-${f.key}`}
                  active={filter === f.key}
                  value={f.key}
                  onClick={() => setFilter(f.key as any)}
                  titleText={t('ai_chat.inspector.filter.title', {
                    label: f.label,
                  })}
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
                      <div className="card-label">
                        {t('ai_chat.inspector.cli_command')}
                      </div>
                      <pre className="command-pre">
                        <code>{activeTurn.toolCommand}</code>
                      </pre>
                    </div>
                  )}

                {filteredActivities.length === 0 ? (
                  <div className="activity-inspector-empty">
                    <div className="empty-title">
                      {counts.all === 0
                        ? t('ai_chat.inspector.empty.none_title')
                        : t('ai_chat.inspector.empty.filtered_title')}
                    </div>
                    <div className="empty-sub">
                      {counts.all === 0
                        ? t('ai_chat.inspector.empty.none_sub')
                        : t('ai_chat.inspector.empty.filtered_sub')}
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
