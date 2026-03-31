import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Source, Links, RefreshRate, TimeZones} from 'src/types'
import {Page} from 'src/reusable_ui'
import {ButtonShape, Radio} from 'src/reusable_ui'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import TableComponent from 'src/device_management/components/TableComponent'
import {
  serverListColumns,
  serverListQueries,
  serverListLineQueries,
} from 'src/hosts/constants/serverListColumns'
import * as appActions from 'src/shared/actions/app'
import {executeQueries} from 'src/shared/apis/query'
import {getHosts} from 'src/shared/apis/host'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {generateForHosts} from 'src/utils/tempVars'
import {TableLineChartPoint, TimeSeriesValue} from 'src/types/series'
import {mergeResultsByHost} from 'src/dashboards/utils/tableLineChart'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {CLOUD_TIME_RANGE, timeRanges} from 'src/shared/data/timeRanges'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import LoadingDots from 'src/shared/components/LoadingDots'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

type HostCellValue = TimeSeriesValue | TimeSeriesValue[] | TableLineChartPoint[]
type FetchIntent = 'mode-switch' | 'refresh'
const TimeRangeDropdownComponent = TimeRangeDropdown as any

export interface ManualRefresh {
  key: string
  value: number
}

interface Props {
  source: Source
  links: Links
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  timeZone: TimeZones
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (timeRange: CloudTimeRange) => void
  setTimeZone: typeof appActions.setTimeZone
}
export function NewHostsPage({
  source,
  cloudAutoRefresh,
  cloudTimeRange,
  timeZone,
  onChooseCloudAutoRefresh,
  onChooseCloudTimeRange,
  setTimeZone,
}: Props) {
  const [manualRefreshState, setManualRefreshState] = useState<ManualRefresh>({
    key: 'server-list',
    value: Date.now(),
  })

  const [tableData, setTableData] = useState<Record<string, HostCellValue>[]>(
    []
  )
  const [isTableLoading, setIsTableLoading] = useState(true)

  const apiHostsResultRef = useRef<any>(null)

  useEffect(() => {
    getHosts()
      .then(data => {
        console.log('getHosts API Result:', data)
        apiHostsResultRef.current = data
      })
      .catch(err => {
        console.error('getHosts error:', err)
        apiHostsResultRef.current = {error: err.message}
      })
  }, [])

  const [displayedChartMode, setDisplayedChartMode] = useState<
    'gauge' | 'line'
  >('gauge')

  const [pendingChartMode, setPendingChartMode] = useState<'gauge' | 'line'>(
    'gauge'
  )

  const [isModeSwitching, setIsModeSwitching] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  const [isError, setIsError] = useState(false)

  const requestIdRef = useRef(0)

  let intervalID

  const handleManualRefresh = () => {
    setManualRefreshState({
      ...manualRefreshState,
      value: Date.now(),
    })
  }

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds, group} = option
    onChooseCloudAutoRefresh({[group]: milliseconds})
  }

  const handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      onChooseCloudTimeRange({serverList: {lower, upper}})
    } else {
      onChooseCloudTimeRange({
        serverList: timeRanges.find(tr => tr.lower === lower),
      })
    }
  }

  const columns = useMemo(
    () =>
      serverListColumns({sourceID: source.id, chartMode: displayedChartMode}),
    [source.id, displayedChartMode]
  )

  useEffect(() => {
    let isSubscribed = true

    fetchTableData({
      isSubscribed,
      fetchIntent: 'refresh',
      chartMode: displayedChartMode,
    })

    return () => {
      isSubscribed = false
    }
  }, [
    source,
    cloudTimeRange?.serverList?.lower,
    cloudTimeRange?.serverList?.upper,
    manualRefreshState.value,
    timeZone,
    cloudAutoRefresh.serverList,
  ])

  useEffect(() => {
    if (pendingChartMode === displayedChartMode) {
      return
    }

    let isSubscribed = true

    fetchTableData({
      isSubscribed,
      fetchIntent: 'mode-switch',
      chartMode: pendingChartMode,
    })

    return () => {
      isSubscribed = false
    }
  }, [pendingChartMode, displayedChartMode])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.serverList)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.serverList) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        fetchTableData({
          isSubscribed: true,
          fetchIntent: 'refresh',
          chartMode: displayedChartMode,
        })
      }, cloudAutoRefresh.serverList)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.serverList)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh, displayedChartMode])

  const fetchTableData = async ({
    isSubscribed,
    fetchIntent,
    chartMode,
  }: {
    isSubscribed: boolean
    fetchIntent: FetchIntent
    chartMode: 'gauge' | 'line'
  }) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const isModeSwitchFetch = fetchIntent === 'mode-switch'

    if (isModeSwitchFetch) {
      setIsModeSwitching(true)
      setIsTableLoading(true)
    } else {
      setIsRefreshing(true)
    }

    const selectedTimeRange = cloudTimeRange?.serverList || {
      lower: 'now() - 1h',
      upper: 'now()',
    }

    const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
      selectedTimeRange
    )
    const templates = [
      ...generateForHosts(source),
      dashboardTime,
      upperDashboardTime,
    ]

    const selectedQueries =
      chartMode === 'line' ? serverListLineQueries : serverListQueries

    const querySet = selectedQueries.map(query => ({
      id: query.id,
      text: query.text,
      db: source.telegraf,
    }))

    try {
      const results = await executeQueries(source, querySet, templates)
      if (!isSubscribed || requestId !== requestIdRef.current) {
        return
      }
      let mergedData = mergeResultsByHost(results)

      if (Array.isArray(apiHostsResultRef.current)) {
        const allowedHosts = new Set(
          apiHostsResultRef.current.map((h: any) => h.hostname)
        )
        mergedData = mergedData.filter(row =>
          allowedHosts.has(row.host as string)
        )
      }

      setTableData(mergedData)
      if (isModeSwitchFetch) {
        setDisplayedChartMode(chartMode)
      }
      setIsModeSwitching(false)
      setIsTableLoading(false)
      setIsRefreshing(false)
    } catch (error) {
      console.error('Failed to fetch server list data', error)
      setIsError(true)
      if (isSubscribed && requestId === requestIdRef.current) {
        setIsModeSwitching(false)
        setIsTableLoading(false)
        setIsRefreshing(false)
      }
    }
  }

  return (
    <Page className="hosts-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Server List" />
        </Page.Header.Left>
        <Page.Header.Right>
          <SourceIndicator />
          <AutoRefreshDropdown
            onChoose={handleChooseAutoRefresh}
            selected={0}
            onManualRefresh={handleManualRefresh}
            customAutoRefreshOptions={getTimeOptionByGroup('serverList')}
            customAutoRefreshSelected={cloudAutoRefresh}
          />
          <TimeRangeDropdownComponent
            onChooseTimeRange={handleChooseTimeRange}
            selected={cloudTimeRange?.serverList ?? CLOUD_TIME_RANGE.serverList}
          />

          <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <div className="host-page-graph-table-container-wrapper">
          <div className="host-page-graph-table-container table-gauge-chart">
            {!isError ? (
              <TableComponent
                data={tableData || []}
                bodyClassName="server-list-table"
                columns={columns}
                isLoading={isTableLoading}
                isSearchDisplay={true}
                isDotKey={true}
                enableSharedChartHover={displayedChartMode === 'line'}
                toprightRender={
                  <div className="topright-render-container">
                    {isRefreshing ? (
                      <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
                    ) : null}
                  </div>
                }
                topLeftRender={
                  <Radio shape={ButtonShape.Default}>
                    <Radio.Button
                      id="host-chart-mode-gauge"
                      titleText="Gauge"
                      value="gauge"
                      active={pendingChartMode === 'gauge'}
                      onClick={() => {
                        if (pendingChartMode !== 'gauge' && !isModeSwitching) {
                          setPendingChartMode('gauge')
                        }
                      }}
                    >
                      Gauge
                    </Radio.Button>
                    <Radio.Button
                      id="host-chart-mode-line"
                      titleText="Line"
                      value="line"
                      active={pendingChartMode === 'line'}
                      onClick={() => {
                        if (pendingChartMode !== 'line' && !isModeSwitching) {
                          setPendingChartMode('line')
                        }
                      }}
                    >
                      Line
                    </Radio.Button>
                  </Radio>
                }
              />
            ) : (
              <div className="empty-table-container">
                <div className="empty-table-content">
                  <p>No data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Page.Contents>
    </Page>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh, cloudTimeRange, timeZone},
      ephemeral: {inPresentationMode},
    },
    links,
  } = state
  return {
    links,
    timeZone,
    cloudTimeRange,
    cloudAutoRefresh,
    inPresentationMode,
  }
}

const mdtp = dispatch => ({
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),

  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(NewHostsPage)
