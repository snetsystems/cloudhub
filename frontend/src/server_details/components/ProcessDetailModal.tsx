import React, {useEffect, useState} from 'react'
import TableComponent from 'src/device_management/components/TableComponent'
import type {Source} from 'src/types/sources'
import type {Addon} from 'src/types/auth'
import type {ColumnInfo} from 'src/types'
import type {DataTableObject} from 'src/types/tableType'
import {TimeZones} from 'src/types/app'

export interface ProcessDetailServerDetail {
  selectedHost: string | null
  source: Source | null
  addons?: Addon[]
}

interface ProcessDetailModalProps {
  isOpen: boolean
  onClose: () => void
  serverDetail: ProcessDetailServerDetail
  nameInfo: DataTableObject | null
}

const LIMIT_TABLE_COLUMNS: ColumnInfo[] = [
  {key: 'limit', name: 'Limit'},
  {key: 'softLimit', name: 'Soft Limit'},
  {key: 'hardLimit', name: 'Hard Limit'},
  {key: 'unit', name: 'Unit'},
]

function ProcessDetailBlock({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="process-detail-modal__block">
      <h3 className="process-detail-modal__block-title">{title}</h3>
      <div className="process-detail-modal__block-content">{children}</div>
    </div>
  )
}

function ProcessDetailModal({
  isOpen,
  onClose,
  serverDetail: _serverDetail,
  nameInfo: _nameInfo,
}: ProcessDetailModalProps) {
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

  if (!isMounted) return null

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
        aria-labelledby="process-detail-modal-title"
      >
        <div className="process-detail-modal__header">
          <h2
            id="process-detail-modal-title"
            className="process-detail-modal__title"
          >
            프로세스 상세
          </h2>
        </div>
        <div className="process-detail-modal__scroll">
          <div className="process-detail-modal__body">
            <div className="process-detail-modal__grid process-detail-modal__grid--top">
              <ProcessDetailBlock title="CPU" />
              <ProcessDetailBlock title="Memory" />
              <ProcessDetailBlock title="Process I/O" />
            </div>
            <div className="process-detail-modal__grid process-detail-modal__grid--bottom">
              <ProcessDetailBlock title="IP" />
              <ProcessDetailBlock title="File" />
              <ProcessDetailBlock title="Limit">
                <TableComponent
                  data={[]}
                  columns={LIMIT_TABLE_COLUMNS}
                  isSearchDisplay={false}
                  timeZone={TimeZones.Local}
                />
              </ProcessDetailBlock>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ProcessDetailModal
