import _ from 'lodash'
import React, {useEffect, useState} from 'react'

import {
  Cell,
  Layout,
  PredictionManualRefresh,
  Source,
  TimeRange,
} from 'src/types'
import ReactObserver from 'react-resize-observer'
import {timeRanges} from 'src/shared/data/timeRanges'

import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {setAutoRefresh} from 'src/shared/actions/app'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import PredictionDashboardHeader from './PredictionDashboardHeader'
import {getLayouts} from 'src/hosts/apis'
import {getDeep} from 'src/utils/wrappers'
import {getCells} from 'src/hosts/utils/getCells'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

interface Props {
  source: Source
  autoRefresh?: number
  manualRefresh: number
}

const PredictionInstanceWrapper = React.memo(
  ({source, autoRefresh, manualRefresh}: Props) => {
    const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
      timeRanges.find(tr => tr.lower === 'now() - 1h')
    )
    const [selfManualRefresh, setSelfManualRefresh] = useState<number>(
      manualRefresh
    )
    const [layoutCells, setLayoutCells] = useState<Cell[]>([])

    const instance = []

    useEffect(() => {
      getLayout()
    }, [])

    useEffect(() => {
      GlobalAutoRefresher.poll(autoRefresh)
    }, [autoRefresh])

    const getLayout = async () => {
      const layoutResults = await getLayouts()
      const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

      getLayoutsforInstance(layouts)
    }

    const getLayoutsforInstance = async (layouts: Layout[]) => {
      const filteredLayouts = layouts
        .filter(layout => {
          return layout.app === 'snmp_nx'
        })
        .sort((x, y) => {
          return x.measurement < y.measurement
            ? -1
            : x.measurement > y.measurement
            ? 1
            : 0
        })

      setLayoutCells(getCells(filteredLayouts, source))

      return {filteredLayouts}
    }

    const tempVars = generateForHosts(source)

    const debouncedFit = _.debounce(() => {
      WindowResizeEventTrigger()
    }, 150)

    const handleOnResize = (): void => {
      debouncedFit()
    }

    const handleChooseTimeRange = ({lower, upper}) => {
      if (upper) {
        setSelfTimeRange({lower, upper})
      } else {
        const timeRange = timeRanges.find(range => range.lower === lower)
        setSelfTimeRange(timeRange)
      }
    }

    return (
      <>
        <div
          className="panel"
          style={{height: '100%', backgroundColor: GRAPH_BG_COLOR}}
        >
          <PredictionDashboardHeader
            cellName={`Time Series Monitoring`}
            cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
            cellTextColor={DEFAULT_CELL_TEXT_COLOR}
          >
            <div className="page-header--right" style={{zIndex: 3}}>
              <TimeRangeDropdown
                onChooseTimeRange={handleChooseTimeRange}
                selected={selfTimeRange}
              />
            </div>
          </PredictionDashboardHeader>
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
                    manualRefresh={selfManualRefresh}
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
      // src\clouds\containers\OpenStackPage.tsx
    )
  }
)

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh},
      ephemeral: {inPresentationMode},
    },
    links,
  } = state
  return {
    links,
    autoRefresh,
    inPresentationMode,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
})

const areEqual = (prevProps, nextProps) => {
  return prevProps.value === nextProps.value
}

export default React.memo(
  connect(mstp, mdtp, null)(PredictionInstanceWrapper),
  areEqual
)
