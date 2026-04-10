import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Source, Links, RefreshRate, TimeZones} from 'src/types'
import {Page} from 'src/reusable_ui'
import {
  ButtonShape,
  Radio,
  Button,
  ComponentColor,
  IconFont,
} from 'src/reusable_ui'
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
import {getHosts, Host} from 'src/shared/apis/host'
import {getActiveKapacitor, kapacitorProxy} from 'src/shared/apis'
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
import AlertStatusSummary from 'src/hosts/components/AlertStatusSummary'
import AlertStatusModal from 'src/hosts/components/AlertStatusModal'
import QuestionMarkTooltip from 'src/shared/components/QuestionMarkTooltip'
import {AlertLevel, AlertStatusMap} from 'src/hosts/types/alertStatus'

type HostCellValue = TimeSeriesValue | TimeSeriesValue[] | TableLineChartPoint[]
type FetchIntent = 'mode-switch' | 'refresh'
const TimeRangeDropdownComponent = TimeRangeDropdown as any

// ─── Alert query ───────────────────────────────────────
const ALERT_DB = 'Default'

// 모니터링할 alertName 목록 (TICKscript의 .tag('alertName', ...) 와 일치해야 함)
const ALERT_NAMES = [
  'server-cpu-usage',
  'server-mem-usage',
  'server-disk-usage',
  'server-disk-io',
  'server-network-traffic',
  'server-deadman',
]

// GROUP BY time() 없이 각 (host, level, alertName)의 가장 최신 이벤트만 가져옴
// FILL(none): 값 없는 버킷 생략 → OK 회복 이벤트가 null로 사라지지 않음
const ALERT_QUERY_TEXT = `SELECT last("message") AS "message"
FROM "${ALERT_DB}"."autogen"."cloudhub_alerts"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
  AND (${ALERT_NAMES.map(n => `"alertName"='${n}'`).join(' OR ')})
GROUP BY "host", "level", "alertName"
FILL(none)`

// level 우선순위 (높을수록 심각)
const LEVEL_PRIORITY: Record<AlertLevel, number> = {
  danger: 3,
  warn: 2,
  normal: 1,
  unknown: 0,
}

// InfluxDB level 태그 → AlertLevel 매핑
const mapInfluxLevel = (influxLevel: string): AlertLevel => {
  const upper = (influxLevel ?? '').toUpperCase()
  if (upper === 'CRITICAL') return 'danger'
  if (upper === 'WARNING') return 'warn'
  if (upper === 'OK') return 'normal'
  return 'unknown'
}

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

  const [alertStatusMap, setAlertStatusMap] = useState<AlertStatusMap>({})

  const [selectedAlertHost, setSelectedAlertHost] = useState<string | null>(
    null
  )

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false)

  const [isAlertsEnabled, setIsAlertsEnabled] = useState(true)

  const apiHostsResultRef = useRef<Host[] | {error: string} | null>(null)

  useEffect(() => {
    getHosts()
      .then(data => {
        apiHostsResultRef.current = data
      })
      .catch(err => {
        console.error('getHosts error:', err)
        apiHostsResultRef.current = {error: err.message}
      })
  }, [])

  useEffect(() => {
    const checkKapacitorScripts = async () => {
      try {
        const activeKap = await getActiveKapacitor(source)
        if (!activeKap) {
          setIsAlertsEnabled(false)
          return
        }
        const resp = await kapacitorProxy(
          activeKap,
          'GET',
          '/kapacitor/v1/tasks'
        )
        const tasks = resp.data?.tasks || []

        const hasScripts = tasks.some(
          t => ALERT_NAMES.includes(t.id) && t.status === 'enabled'
        )
        setIsAlertsEnabled(hasScripts)
      } catch (e) {
        console.warn('Failed to check kapacitor tasks', e)
        setIsAlertsEnabled(false)
      }
    }
    checkKapacitorScripts()
  }, [source])

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
      serverListColumns({
        sourceID: source.id,
        chartMode: displayedChartMode,
        alertStatusMap,
        isAlertsEnabled,
        onStatusIconClick: (host: string) => {
          setSelectedAlertHost(host)
          setIsAlertModalOpen(true)
        },
      }),
    [source.id, displayedChartMode, alertStatusMap, isAlertsEnabled]
  )

  useEffect(() => {
    let isSubscribed = true

    fetchTableData({
      isSubscribed,
      fetchIntent: 'refresh',
      chartMode: displayedChartMode,
    })
    fetchAlertData()

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
        fetchAlertData()
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

    setIsError(false)

    if (isModeSwitchFetch) {
      setIsModeSwitching(true)
      setIsTableLoading(true)
    } else {
      setIsRefreshing(true)
      if (isError) {
        setIsTableLoading(true)
      }
    }

    try {
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

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 15000)
      )

      const results = (await Promise.race([
        executeQueries(source, querySet, templates),
        timeoutPromise,
      ])) as any
      if (!isSubscribed || requestId !== requestIdRef.current) {
        return
      }
      let mergedData = mergeResultsByHost(results)

      if (Array.isArray(apiHostsResultRef.current)) {
        const hosts = apiHostsResultRef.current as Host[]
        const allowedHosts = new Set(hosts.map(h => h.hostname))
        const hostMap = new Map<string, Host>(hosts.map(h => [h.hostname, h]))

        mergedData = mergedData
          .filter(row => allowedHosts.has(row.host as string))
          .map(row => {
            const hostInfo = hostMap.get(row.host as string)
            if (hostInfo && Array.isArray(hostInfo.disks) && typeof row.Device === 'string') {
              const matchedDisk = hostInfo.disks.find(d => {
                if (!d.device) return false
                const paths = d.device.split('/')
                return paths[paths.length - 1] === row.Device
              })
              if (matchedDisk && matchedDisk.mountPoint) {
                row.Device = matchedDisk.mountPoint
              }
            }
            return row
          })
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

  const fetchAlertData = async () => {
    try {
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

      const querySet = [
        {
          id: 'server-list-alert-status',
          text: ALERT_QUERY_TEXT,
          db: ALERT_DB,
        },
      ]

      const results = (await executeQueries(source, querySet, templates)) as any

      const result = results?.[0]?.value
      if (!result) return

      const series: any[] = result?.results?.[0]?.series ?? []

      const perAlertLatest: Record<
        string,
        Record<string, {time: string; level: AlertLevel; message: string}>
      > = {}

      series.forEach(s => {
        const host: string = s?.tags?.host
        const levelTag: string = s?.tags?.level ?? ''
        const alertName: string = s?.tags?.alertName ?? ''
        if (!host || !alertName) return

        const level: AlertLevel = mapInfluxLevel(levelTag)
        const timeIndex = (s.columns ?? []).indexOf('time')
        const messageIndex = (s.columns ?? []).indexOf('message')

        const row = s?.values?.[0]
        if (!row) return
        const eventTime: string | null = timeIndex >= 0 ? row[timeIndex] : null
        const messageStr: string = messageIndex >= 0 ? row[messageIndex] : ''
        if (!eventTime) return

        if (!perAlertLatest[host]) perAlertLatest[host] = {}

        const existing = perAlertLatest[host][alertName]
        if (!existing || eventTime > existing.time) {
          perAlertLatest[host][alertName] = {
            time: eventTime,
            level,
            message: messageStr,
          }
        }
      })

      const nextMap: AlertStatusMap = {}
      Object.entries(perAlertLatest).forEach(([host, alertMap]) => {
        const history = Object.entries(alertMap).map(
          ([alertName, {time, level, message}]) => ({
            time,
            level,
            alertName,
            message,
          })
        )

        let currentLevel = history.reduce<AlertLevel>(
          (worst, {level}) =>
            LEVEL_PRIORITY[level] > LEVEL_PRIORITY[worst] ? level : worst,
          'normal'
        )

        const hasDeadman = history.some(
          h => h.alertName === 'server-deadman' && h.level === 'danger'
        )
        if (hasDeadman) {
          currentLevel = 'unknown'
        }

        nextMap[host] = {currentLevel, history}
      })

      setAlertStatusMap(nextMap)
    } catch (err) {
      console.error('Failed to fetch alert status data', err)
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
        <div className="host-page-graph-table-container-wrapper host-page-graph-table-container">
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
                <div className="server-list-topleft">
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
                  <div className="alert-status-summary-container">
                    <AlertStatusSummary
                      alertStatusMap={alertStatusMap}
                      tableData={tableData}
                      isAlertsEnabled={isAlertsEnabled}
                    />
                    {!isAlertsEnabled && (
                      <QuestionMarkTooltip
                        tipID="alert-status-disabled"
                        tipContent="Kapacitor alarm settings are required to show the server status."
                      />
                    )}
                  </div>
                </div>
              }
            />
          ) : (
            <div className="empty-table-container">
              <div className="empty-table-content empty-table-retry">
                <p>Failed to load data or responding too slowly.</p>
                <Button
                  text="Retry"
                  icon={IconFont.Refresh}
                  onClick={handleManualRefresh}
                  color={ComponentColor.Primary}
                />
              </div>
            </div>
          )}
        </div>
      </Page.Contents>
      <AlertStatusModal
        isVisible={isAlertModalOpen}
        host={selectedAlertHost ?? ''}
        alertStatus={
          selectedAlertHost ? alertStatusMap[selectedAlertHost] ?? null : null
        }
        onClose={() => setIsAlertModalOpen(false)}
      />
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
