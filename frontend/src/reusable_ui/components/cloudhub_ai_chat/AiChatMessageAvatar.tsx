import React, {FC} from 'react'
import classnames from 'classnames'

export type ChatMessageSender = 'user' | 'ai' | 'system' | 'skill'

interface AiChatMessageAvatarProps {
  sender: ChatMessageSender
  className?: string
}

const SENDER_LABEL: Record<ChatMessageSender, string> = {
  user: 'User',
  ai: 'AI',
  system: 'System',
  skill: 'Skill',
}

// Simple line-art SVG glyphs (no emoji) so each sender role is visually
// distinct while staying legible at 22px avatar size.
const AVATAR_GLYPH: Record<ChatMessageSender, React.ReactNode> = {
  user: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <circle cx="12" cy="8" r="3.6" fill="currentColor" />
      <path
        d="M4.5 19.5C5.6 15.9 8.4 14 12 14s6.4 1.9 7.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <path
        d="M12 3l1.7 4.7L18.5 9l-4.8 1.7L12 15l-1.7-4.3L5.5 9l4.8-1.3L12 3z"
        fill="currentColor"
      />
      <circle cx="18.5" cy="17" r="1.8" fill="currentColor" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <path
        d="M12 8.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 3.2v2.1M12 18.7v2.1M20.8 12h-2.1M5.3 12H3.2M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5M18.1 18.1l-1.5-1.5M7.4 7.4L5.9 5.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ),
  skill: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <path
        d="M9.4 4.6a1.9 1.9 0 013.2 1.5v.4a1.4 1.4 0 001.4 1.4h.4a1.9 1.9 0 011.5 3.2 1.9 1.9 0 01-1.5 3.2h-.4a1.4 1.4 0 00-1.4 1.4v.4a1.9 1.9 0 11-3.8 0v-.4a1.4 1.4 0 00-1.4-1.4h-.4a1.9 1.9 0 010-3.8h.4A1.4 1.4 0 009 9.1v-.4a1.9 1.9 0 01.4-1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

export const AiChatMessageAvatar: FC<AiChatMessageAvatarProps> = ({
  sender,
  className,
}) => {
  return (
    <div
      className={classnames('message-avatar', `avatar-${sender}`, className)}
      title={SENDER_LABEL[sender]}
    >
      {AVATAR_GLYPH[sender]}
    </div>
  )
}

export default AiChatMessageAvatar
