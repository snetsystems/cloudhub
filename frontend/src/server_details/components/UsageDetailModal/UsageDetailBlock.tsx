import React from 'react'

interface UsageDetailBlockProps {
  title: string
  children?: React.ReactNode
  blockClassName?: string
}

export function UsageDetailBlock({
  title,
  children,
  blockClassName,
}: UsageDetailBlockProps) {
  return (
    <div
      className={`process-detail-modal__block${
        blockClassName ? ` ${blockClassName}` : ''
      }`}
    >
      <h3 className="process-detail-modal__block-title">{title}</h3>
      <div className="process-detail-modal__block-content">{children}</div>
    </div>
  )
}
