import React, {FC} from 'react'
import classnames from 'classnames'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {Button, ButtonShape, ComponentColor, IconFont} from 'src/reusable_ui'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {ChatSession} from 'src/ai_chat/containers/CloudhubAiChatStandalone'

interface Props {
  sessions: ChatSession[]
  activeSessionId: string
  isCollapsed: boolean
  onSelectSession: (id: string) => void
  onDeleteSession?: (id: string) => void
  onCreateNewChat: () => void
  onToggleCollapse: () => void
}

export const formatTimeAgo = (dateInput?: string | number | Date): string => {
  if (!dateInput) return ''
  const d =
    typeof dateInput === 'number' || typeof dateInput === 'string'
      ? new Date(dateInput)
      : dateInput
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return ''

  const diffMs = Math.max(0, Date.now() - d.getTime())
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffMin < 1) {
    return '1m'
  }
  if (diffMin < 60) {
    return `${diffMin}m`
  }
  if (diffHours < 24) {
    return `${diffHours}h`
  }
  if (diffDays < 30) {
    return `${diffDays}d`
  }
  if (diffMonths < 12) {
    return `${diffMonths}mo`
  }
  return `${diffYears}y`
}

export const AiChatSidebar: FC<Props> = ({
  sessions,
  activeSessionId,
  isCollapsed,
  onSelectSession,
  onDeleteSession,
  onCreateNewChat,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    return (
      <div className="chat-sidebar collapsed">
        <div className="sidebar-action-header">
          <Button
            icon={IconFont.CaretRight}
            onClick={onToggleCollapse}
            shape={ButtonShape.Square}
            color={ComponentColor.Default}
            titleText="대화 목록 펼치기"
          />
        </div>
        <div className="collapsed-icon-list">
          <Button
            icon={IconFont.Plus}
            onClick={onCreateNewChat}
            shape={ButtonShape.Square}
            color={ComponentColor.Primary}
            titleText="새 대화 시작"
          />
          {sessions.map(s => (
            <div
              key={s.id}
              className={classnames('collapsed-session-dot', {
                active: s.id === activeSessionId,
              })}
              onClick={() => onSelectSession(s.id)}
              title={s.title}
            >
              <span className={`icon ${IconFont.Chat}`} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="chat-sidebar">
      <div className="sidebar-action-header">
        <Button
          text="New Chat"
          icon={IconFont.Plus}
          onClick={onCreateNewChat}
          color={ComponentColor.Primary}
          customClass="full-width"
        />
        <Button
          icon={IconFont.CaretLeft}
          onClick={onToggleCollapse}
          shape={ButtonShape.Square}
          color={ComponentColor.Default}
          titleText="사이드바 접기"
        />
      </div>

      <div className="session-list-wrapper">
        <FancyScrollbar autoHide={true}>
          <div className="session-list">
            {sessions.map(session => {
              const timeAgoStr = formatTimeAgo(
                session.updatedAt || session.createdAt
              )

              return (
                <div
                  key={session.id}
                  className={classnames('session-item', {
                    active: session.id === activeSessionId,
                  })}
                  onClick={() => onSelectSession(session.id)}
                >
                  <span className={`session-icon icon ${IconFont.Chat}`} />
                  <span className="session-text-title">{session.title}</span>
                  {timeAgoStr && (
                    <span className="session-time-ago">{timeAgoStr}</span>
                  )}
                  {onDeleteSession && (
                    <div
                      className="session-delete-wrapper"
                      onClick={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <ConfirmButton
                        icon="trash"
                        size="btn-xs"
                        square={true}
                        type="btn-danger"
                        confirmText="삭제"
                        customClass="session-delete-confirm-btn"
                        isEventStopPropagation={true}
                        position="left"
                        confirmAction={() => onDeleteSession(session.id)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </FancyScrollbar>
      </div>
    </div>
  )
}

export default AiChatSidebar
