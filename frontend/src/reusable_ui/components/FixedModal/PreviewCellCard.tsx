import React, {useEffect, useRef, useState} from 'react'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {Cell, Source, TimeRange, Template} from 'src/types'
import {normalizeCellForPreview} from './importSelectionPreview'

interface PreviewCellCardProps {
  cell: Cell
  source?: Source
  timeRange?: TimeRange
  templates?: Template[]
}

const defaultTimeRange: TimeRange = {upper: null, lower: null}

function PreviewCellCard({
  cell,
  source,
  timeRange,
  templates = [],
}: PreviewCellCardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          setVisible(true)
        } else if (entry) {
          setVisible(false)
        }
      },
      {root: null, rootMargin: '80px', threshold: 0.01}
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const previewCell = normalizeCellForPreview(cell)

  return (
    <div className="import-selection-preview-card" ref={rootRef}>
      <div className="import-selection-preview-card__title">
        {cell.name || 'Untitled cell'}
      </div>
      <div className="import-selection-preview-card__body">
        {!source ? (
          <div className="import-selection-preview-card__unavailable">
            Preview unavailable
          </div>
        ) : !visible ? (
          <div className="import-selection-preview-card__placeholder">
            Loading preview…
          </div>
        ) : (
          <LayoutRenderer
            cells={[previewCell]}
            source={source}
            sources={[source]}
            isEditable={false}
            isStatusPage={false}
            isStaticPage={false}
            timeRange={timeRange || defaultTimeRange}
            manualRefresh={0}
            templates={templates}
            host=""
          />
        )}
      </div>
    </div>
  )
}

export default PreviewCellCard
