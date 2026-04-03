import React, {useEffect, useMemo, useState} from 'react'
import {CpuDetailContent} from './details/CpuDetailContent'
import {MemoryDetailContent} from './details/MemoryDetailContent'
import {NetworkDetailContent} from './details/NetworkDetailContent'
import {DiskDetailContent} from './details/DiskDetailContent'
import type {UsageDetailType, UsageDetailServerContext} from './types'
import {buildDetailTemplates, DEFAULT_DETAIL_TIME_RANGE} from './utils'
import type {Template, TimeRange} from 'src/types'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import type {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

export interface UsageDetailModalProps {
  isOpen: boolean
  onClose: () => void
  detailType: UsageDetailType | null
  serverContext: UsageDetailServerContext
  autoRefresh: number
  onAutoRefreshChange: (milliseconds: number) => void
  onCloudTimeRangeChange?: (timeRange: TimeRange) => void
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
  templates,
}: {
  detailType: UsageDetailType
  serverContext: UsageDetailServerContext
  templates: Template[] | null
}) {
  switch (detailType) {
    case 'cpu':
      return (
        <CpuDetailContent serverContext={serverContext} templates={templates} />
      )
    case 'memory':
      return (
        <MemoryDetailContent
          serverContext={serverContext}
          templates={templates}
        />
      )
    case 'network':
      return (
        <NetworkDetailContent
          serverContext={serverContext}
          templates={templates}
        />
      )
    case 'disk':
      return (
        <DiskDetailContent
          serverContext={serverContext}
          templates={templates}
        />
      )
    default:
      return null
  }
}

export const UsageDetailModal: React.FC<UsageDetailModalProps> = ({
  isOpen,
  onClose,
  detailType,
  serverContext,
  autoRefresh,
  onAutoRefreshChange,
  onCloudTimeRangeChange,
}) => {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)
  const [localTimeRange, setLocalTimeRange] = useState<TimeRange | null>(null)
  const [manualRefresh, setManualRefresh] = useState<number>(Date.now())

  useEffect(() => {
    if (isOpen) {
      setLocalTimeRange(serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE)
    }
  }, [isOpen, serverContext.timeRange])

  const currentTimeRange =
    localTimeRange ?? serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE

  const templates = useMemo(() => {
    if (!serverContext.source || !serverContext.selectedHost) return null
    return buildDetailTemplates(
      serverContext.source,
      currentTimeRange,
      serverContext.selectedHost
    )
  }, [serverContext.source, currentTimeRange, serverContext.selectedHost])

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
        <div
          className="process-detail-modal__header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flex: 1,
              minWidth: 0,
            }}
          >
            <h2
              id="usage-detail-modal-title"
              className="process-detail-modal__title"
              style={{flexShrink: 0}}
            >
              {title}
            </h2>
            <div
              id="usage-detail-modal-header-portal"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <AutoRefreshDropdown
              selected={autoRefresh}
              onChoose={(option: AutoRefreshOption) =>
                onAutoRefreshChange(option.milliseconds)
              }
              onManualRefresh={() => setManualRefresh(Date.now())}
            />
            {currentTimeRange && (
              <TimeRangeDropdown
                selected={currentTimeRange}
                onChooseTimeRange={tr => {
                  setLocalTimeRange(tr)
                  onCloudTimeRangeChange?.(tr)
                }}
              />
            )}
          </div>
        </div>
        <div className="process-detail-modal__scroll">
          <DetailContent
            detailType={detailType}
            serverContext={{
              ...serverContext,
              timeRange: currentTimeRange,
              manualRefresh,
            }}
            templates={templates}
          />
        </div>
      </div>
    </>
  )
}
