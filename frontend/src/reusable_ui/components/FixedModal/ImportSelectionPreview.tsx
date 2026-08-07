import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {interval} from 'src/shared/constants'
import {ImportSelectionPayload} from 'src/shared/types/importModal'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {Source, TimeRange} from 'src/types'
import {getPreviewCellsFromSelection} from './importSelectionPreview'
import PreviewCellCard from './PreviewCellCard'

interface OwnProps {
  selection: ImportSelectionPayload
}

interface StateProps {
  source?: Source
  timeRange?: TimeRange
}

type Props = OwnProps & StateProps

function ImportSelectionPreview({selection, source, timeRange}: Props) {
  const cells = getPreviewCellsFromSelection(selection)
  const hasCells = cells.length > 0
  const [mounted, setMounted] = useState(hasCells)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hasCells) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
      return () => cancelAnimationFrame(id)
    }

    setOpen(false)
  }, [hasCells])

  const handleTransitionEnd = (
    event: React.TransitionEvent<HTMLDivElement>
  ) => {
    if (event.propertyName !== 'transform') {
      return
    }
    if (!open && !hasCells) {
      setMounted(false)
    }
  }

  if (!mounted) {
    return null
  }

  const tr = timeRange || {lower: 'now() - 15m', upper: null}
  const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(tr)
  const previewTemplates = [
    ...(selection.templates || []),
    dashboardTime,
    upperDashboardTime,
    interval,
  ]

  return (
    <div
      className={
        open
          ? 'import-selection-preview import-selection-preview--open'
          : 'import-selection-preview'
      }
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="import-selection-preview__header">
        Preview ({cells.length})
      </div>
      <FancyScrollbar autoHide={true}>
        <div className="import-selection-preview__scroll">
          {cells.map(({key, cell}) => (
            <PreviewCellCard
              key={key}
              cell={cell}
              source={source}
              timeRange={tr}
              templates={previewTemplates}
            />
          ))}
        </div>
      </FancyScrollbar>
    </div>
  )
}

const mapStateToProps = ({sources, app}): StateProps => {
  const activeSourceID = app?.persisted?.activeSourceID
  const source =
    sources?.find((s: Source) => s.id === activeSourceID) || sources?.[0]
  const cloudTimeRange = app?.persisted?.cloudTimeRange
  const timeRange =
    cloudTimeRange &&
    Object.keys(cloudTimeRange)
      .map(key => cloudTimeRange[key])
      .find(Boolean)

  return {
    source,
    timeRange: timeRange || {lower: 'now() - 15m', upper: null},
  }
}

export default connect(mapStateToProps)(ImportSelectionPreview)
