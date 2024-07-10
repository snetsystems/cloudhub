import _ from 'lodash'
import React, {useMemo, useState} from 'react'

import {Cell, QueryType, RefreshRate, Source, TimeRange} from 'src/types'
import {fixturePredictionInstanceCells} from '../constants/fixture'
import ReactObserver from 'react-resize-observer'
import {timeRanges} from 'src/shared/data/timeRanges'

import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {setAutoRefresh} from 'src/shared/actions/app'
import OpenStackPageHeader from 'src/clouds/components/OpenStackPageHeader'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import PredictionDashboardHeader from './PredictionDashboardHeader'

interface Props {
  source: Source
  timeRange: TimeRange
  selfAutoRefrsh?: number
  autoRefresh?: number
  onChooseAutoRefresh?: (milliseconds: RefreshRate) => void
  manualRefresh: number
}
function PredictionInstanceWrapper({
  source,
  timeRange,
  selfAutoRefrsh,
  autoRefresh,
  onChooseAutoRefresh,
  manualRefresh,
}: Props) {
  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    timeRange ? timeRange : timeRanges.find(tr => tr.lower === 'now() - 1h')
  )
  const [selfManualRefresh, setSelfManualRefresh] = useState<number>(
    manualRefresh
  )
  const queriesArray = () => {
    const queries = [
      {
        id: '1111',
        query: `SELECT mean("cpu1min") FROM \":db:\".\"autogen\".\"snmp_nx\" WHERE time > now() - 5m GROUP BY agent_host`,
        source: '',
        type: QueryType.InfluxQL,
        queryConfig: {
          database: source.telegraf,
          measurement: 'snmp_nx',
          retentionPolicy: 'autogen',
          fields: [
            {
              value: 'mean',
              type: 'func',
              alias: 'mean_cpu1min',
              args: [
                {
                  value: 'cpu1min',
                  type: 'field',
                },
              ],
            },
          ],
          tags: {},
          groupBy: {
            time: '1m',
            tags: [],
          },
          areTagsAccepted: false,
          rawText: null,
          range: null,
        },
      },
    ]

    return [...Array(6)].map((_, idx) => {
      return [{...queries[0], id: `instance_query_${idx}`}]
    })
  }

  const cells = useMemo<Cell[]>(() => {
    const result = fixturePredictionInstanceCells(source, queriesArray())
    // const result = fixturePredictionInstanceCells(source)

    return result
  }, [source])

  const instance = useMemo(() => {
    return []
  }, [])

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {onChooseAutoRefresh} = this.props
    const {milliseconds} = option
    onChooseAutoRefresh(milliseconds)
  }

  const handleManualRefresh = () => {
    setSelfManualRefresh(Date.now())
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
      this.setState({selfTimeRange: {lower, upper}})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      this.setState({selfTimeRange: timeRange})
    }
  }

  return (
    <>
      <div
        className="panel"
        style={{height: '100%', backgroundColor: GRAPH_BG_COLOR}}
      >
        <PredictionDashboardHeader
          cellName={`Monitoring (Instance Graph)`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div className="page-header--right" style={{zIndex: 3}}>
            {/* <AutoRefreshDropdown
              onChoose={handleChooseAutoRefresh}
              selected={selfAutoRefrsh}
              onManualRefresh={handleManualRefresh}
            />
            <TimeRangeDropdown
              onChooseTimeRange={handleChooseTimeRange}
              selected={selfTimeRange}
            /> */}
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
                  cells={cells}
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

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh},
    },
  } = state

  return {
    selfAutoRefrsh: autoRefresh,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
})
export default connect(mstp, mdtp, null)(PredictionInstanceWrapper)
