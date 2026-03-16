import React, {useEffect, useState} from 'react'
import {CpuDetailContent} from './details/CpuDetailContent'
import {MemoryDetailContent} from './details/MemoryDetailContent'
import {NetworkDetailContent} from './details/NetworkDetailContent'
import {DiskDetailContent} from './details/DiskDetailContent'
import type {UsageDetailType, UsageDetailServerContext} from './types'

export interface UsageDetailModalProps {
  isOpen: boolean
  onClose: () => void
  detailType: UsageDetailType | null
  serverContext: UsageDetailServerContext
}

function getTitle(detailType: UsageDetailType | null): string {
  switch (detailType) {
    case 'cpu':
      return 'CPU 사용률 상세'
    case 'memory':
      return '메모리 사용률 상세'
    case 'network':
      return '네트워크 상세'
    case 'disk':
      return 'Disk 상세'
    default:
      return ''
  }
}

function DetailContent({
  detailType,
  serverContext,
}: {
  detailType: UsageDetailType
  serverContext: UsageDetailServerContext
}) {
  switch (detailType) {
    case 'cpu':
      return <CpuDetailContent serverContext={serverContext} />
    case 'memory':
      return <MemoryDetailContent serverContext={serverContext} />
    case 'network':
      return <NetworkDetailContent serverContext={serverContext} />
    case 'disk':
      return <DiskDetailContent serverContext={serverContext} />
    default:
      return null
  }
}

export const UsageDetailModal: React.FC<UsageDetailModalProps> = ({
  isOpen,
  onClose,
  detailType,
  serverContext,
}) => {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }
    setIsVisible(false)
    const timeoutId = setTimeout(() => setIsMounted(false), 250)
    return () => clearTimeout(timeoutId)
  }, [isOpen])

  if (!isMounted || !detailType) return null

  const title = getTitle(detailType)

  return (
    <>
      <div
        className={`modal-wrapper ${
          isVisible ? 'modal-wrapper--open' : 'modal-wrapper--closing'
        }`}
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        role="presentation"
      />
      <div
        className={`modal-content process-detail-modal ${
          isVisible ? 'modal-content--open' : 'modal-content--closing'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-detail-modal-title"
      >
        <div className="process-detail-modal__header">
          <h2
            id="usage-detail-modal-title"
            className="process-detail-modal__title"
          >
            {title}
          </h2>
        </div>
        <div className="process-detail-modal__scroll">
          <DetailContent detailType={detailType} serverContext={serverContext} />
        </div>
      </div>
    </>
  )
}
