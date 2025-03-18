import React, {useEffect, useState} from 'react'

// Library
import _ from 'lodash'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {Cell, Layout, Source, TimeRange} from 'src/types'
import GPUMonitoringDashboardHeader from './GPUMonitoringDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
import {timeRanges} from 'src/shared/data/timeRanges'
import TimeRangeShiftDropdown from 'src/shared/components/TimeRangeShiftDropdown'
import ReactObserver from 'react-resize-observer'
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getDeep} from 'src/utils/wrappers'
import {getLayout, getLayouts} from 'src/hosts/apis'
import {connect} from 'react-redux'
import {getCellsWithRatio} from 'src/hosts/utils/getCellsWithRatio'

interface Props {
  xNum: number
  title: string
  source: Source
  cellKey: string
  autoRefresh?: number
  manualRefresh?: number
}

ErrorHandling
function GPUMonitoringStatisticsWrapper({
  xNum,
  title,
  source,
  cellKey,
  autoRefresh,
  manualRefresh,
}: Props) {
  //함수 밖으로 빼기
  const getTimeRangeFromLocalStorage = (): TimeRange => {
    if (!!localStorage.getItem(title)) {
      return JSON.parse(localStorage.getItem(title))
    } else {
      return timeRanges.find(tr => tr.lower === 'now() - 1h')
    }
  }

  const [layout, setLayout] = useState<Layout[]>()

  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    getTimeRangeFromLocalStorage()
  )

  const instance = []

  useEffect(() => {
    getLayoutForInstance()
  }, [])

  useEffect(() => {
    GlobalAutoRefresher.poll(autoRefresh)
  }, [autoRefresh])

  useEffect(() => {
    if (!!layout) {
      setLayoutCells(getCellsWithRatio(layout, source, '', xNum, null))
    }
  }, [layout, selfTimeRange])

  const getLayoutForInstance = async () => {
    const SNMP_STATIC_LAYOUT_ID = cellKey
    const layoutResults = await getLayout(SNMP_STATIC_LAYOUT_ID)
    const layout = getDeep<Layout>(layoutResults, 'data', null)

    setLayout(layout ? [layout] : [])
  }

  const tempVars = generateForHosts(source)

  const handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      setSelfTimeRange({lower, upper})
      saveTimeRangeToLocalStorage({lower, upper})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      setSelfTimeRange(timeRange)
      saveTimeRangeToLocalStorage(timeRange)
    }
  }

  const saveTimeRangeToLocalStorage = (timeRange: TimeRange) => {
    localStorage.setItem(
      'monitoring-static-chart',
      JSON.stringify({
        lower: timeRange?.lower ?? 'now() - 1h',
        lowerFlux: timeRange?.lowerFlux,
        upper: timeRange?.upper ?? null,
      })
    )
  }

  const debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 150)

  const handleOnResize = (): void => {
    debouncedFit()
  }

  return (
    <>
      <div
        className="panel"
        style={{height: '100%', backgroundColor: GRAPH_BG_COLOR}}
      >
        <GPUMonitoringDashboardHeader
          cellName={title}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div
            onMouseDown={e => e.stopPropagation()}
            className="page-header--right"
            style={{zIndex: 3}}
          >
            <TimeRangeShiftDropdown
              onChooseTimeRange={handleChooseTimeRange}
              selected={selfTimeRange}
            />
          </div>
        </GPUMonitoringDashboardHeader>
        {!_.isEmpty(instance) ? (
          <div className="panel-body">
            <div className="generic-empty-state">
              <h4 style={{margin: '90px 0'}}>No Instances found</h4>
            </div>
          </div>
        ) : (
          <>
            <div
              className="panel-body"
              style={{backgroundColor: GRAPH_BG_COLOR}}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <ReactObserver onResize={handleOnResize} />
                <LayoutRenderer
                  source={source}
                  sources={[source]}
                  isStatusPage={false}
                  isStaticPage={true}
                  isEditable={false}
                  cells={layoutCells}
                  templates={tempVars}
                  timeRange={selfTimeRange}
                  manualRefresh={manualRefresh}
                  host={''}
                />
              </div>
            </div>
            <div className="dash-graph--gradient-border">
              <div className="dash-graph--gradient-top-left" />
              <div className="dash-graph--gradient-top-right" />
              <div className="dash-graph--gradient-bottom-left" />
              <div className="dash-graph--gradient-bottom-right" />
            </div>
          </>
        )}
      </div>
    </>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh, timeZone},
    },

    links,
  } = state
  return {
    links,
    timeZone,
    autoRefresh,
  }
}

export default connect(mstp, null)(GPUMonitoringStatisticsWrapper)
