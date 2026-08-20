import React, {FC, ReactNode} from 'react'
import classnames from 'classnames'

export type AiChatBadgeVariant =
  | 'done'
  | 'success'
  | 'running'
  | 'info'
  | 'error'
  | 'failed'
  | 'danger'
  | 'blocked'
  | 'redacted'
  | 'warning'
  | 'truncated'
  | 'queued'
  | 'category'
  | 'tag'
  | 'neutral'
  | 'default'

export type AiChatBadgeSize = 'sm' | 'md'

export interface AiChatBadgeProps {
  variant?: AiChatBadgeVariant | string
  size?: AiChatBadgeSize
  icon?: ReactNode
  className?: string
  style?: React.CSSProperties
  title?: string
  children?: ReactNode
  nowrap?: boolean
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void
}

/**
 * AiChatBadge: Unified badge & status highlight component for CloudHub AI Chat.
 * Guarantees no awkward line breaks (white-space: nowrap) and consistent visual styling.
 */
export const AiChatBadge: FC<AiChatBadgeProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  className,
  style,
  title,
  children,
  nowrap = true,
  onClick,
}) => {
  const normalizedVariant = variant ? String(variant).toLowerCase() : 'default'

  return (
    <span
      className={classnames(
        'ai-chat-badge',
        `variant-${normalizedVariant}`,
        `size-${size}`,
        {
          'is-nowrap': nowrap,
          'is-clickable': Boolean(onClick),
        },
        className
      )}
      style={style}
      title={title}
      onClick={onClick}
    >
      {icon && (
        <span className="ai-chat-badge-icon">
          {icon === '✓' ? (
            <span className="done-icon">✓</span>
          ) : icon === '✕' ? (
            <span className="error-icon">✕</span>
          ) : (
            icon
          )}
        </span>
      )}
      {children && <span className="ai-chat-badge-text">{children}</span>}
    </span>
  )
}

export default AiChatBadge
