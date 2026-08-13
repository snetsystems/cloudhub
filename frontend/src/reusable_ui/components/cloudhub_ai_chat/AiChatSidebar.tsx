import React, {FC} from 'react'
import classnames from 'classnames'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {Button, ButtonShape, ComponentColor, IconFont} from 'src/reusable_ui'
import {ChatSession} from 'src/reusable_ui/components/cloudhub_ai_chat/CloudhubAiChatStandalone'

interface Props {
  sessions: ChatSession[]
  activeSessionId: string
  isCollapsed: boolean
  onSelectSession: (id: string) => void
  onCreateNewChat: () => void
  onToggleCollapse: () => void
}

export const AiChatSidebar: FC<Props> = ({
  sessions,
  activeSessionId,
  isCollapsed,
  onSelectSession,
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
            {sessions.map(session => (
              <div
                key={session.id}
                className={classnames('session-item', {
                  active: session.id === activeSessionId,
                })}
                onClick={() => onSelectSession(session.id)}
              >
                <span className={`session-icon icon ${IconFont.Chat}`} />
                <span className="session-text-title">{session.title}</span>
              </div>
            ))}
          </div>
        </FancyScrollbar>
      </div>
    </div>
  )
}

export default AiChatSidebar
