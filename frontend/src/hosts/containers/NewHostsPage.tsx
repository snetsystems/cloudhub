import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Source, Links, RefreshRate, TimeZones, Me} from 'src/types'
import {EDITOR_ROLE, isUserAuthorized} from 'src/auth/Authorized'
import {Page} from 'src/reusable_ui'
import {
  ButtonShape,
  Radio,
  Button,
  ComponentColor,
  IconFont,
  ComponentStatus,
  ComponentSize,
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
import {batchSyncAcceptedMinionsToDb} from 'src/agent_admin/utils/syncMinionFromSaltToDb'
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
import {AlertLevel, AlertStatusMap} from 'src/hosts/types/alertStatus'
import AiAgentsButton from 'src/dashboards/components/AiAgentsButton'
import {DashboardsAiSplit} from 'src/dashboards/components/AiAgentsDrawer'
import {useAiContext} from 'src/ai_chat/hooks/useAiContext'
import {
  buildServerContextPayload,
  buildServerContextSummary,
  SERVER_ATTACH_SKILL,
  SERVER_DIAGNOSE_MESSAGE,
} from 'src/hosts/utils/aiServerContext'

type HostCellValue = TimeSeriesValue | TimeSeriesValue[] | TableLineChartPoint[]
type FetchIntent = 'mode-switch' | 'refresh'
const TimeRangeDropdownComponent = TimeRangeDropdown as any

// ─── Alert query ───────────────────────────────────────
// 각 host별로 모든 알람 발생 이력을 가져옴 (URL Alert 제외)
const getAlertQueryText = (db: string) => `SELECT "message", "value", "level", "alertName", "url"
FROM "${db}"."autogen"."cloudhub_alerts"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host" != "" AND "url" = ''
GROUP BY "host"
ORDER BY time DESC 
LIMIT 1000`

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
  me: Me
  isUsingAuth: boolean
  inPresentationMode?: boolean
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (timeRange: CloudTimeRange) => void
  setTimeZone: typeof appActions.setTimeZone
  router?: any
  location?: any
}

export function NewHostsPage({
  source,
  links,
  cloudAutoRefresh,
  cloudTimeRange,
  timeZone,
  me,
  isUsingAuth,
  inPresentationMode = false,
  onChooseCloudAutoRefresh,
  onChooseCloudTimeRange,
  setTimeZone,
  router,
  location,
}: Props) {
  const {t} = useTranslation()
  const isEditorRole =
    !isUsingAuth || isUserAuthorized(me?.role, EDITOR_ROLE)

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

  const [displayedChartMode, setDisplayedChartMode] = useState<
    'gauge' | 'line'
  >('gauge')

  const [pendingChartMode, setPendingChartMode] = useState<'gauge' | 'line'>(
    'gauge'
  )

  const [isModeSwitching, setIsModeSwitching] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  const [isError, setIsError] = useState(false)

  const [dbHosts, setDbHosts] = useState<Host[]>([])

  const [isFetching, setIsFetching] = useState(false)

  const [hasFetched, setHasFetched] = useState(false)

  const requestIdRef = useRef(0)

  const apiHostsResultRef = useRef<Host[] | {error: string} | null>(null)

  useEffect(() => {
    getHosts()
      .then(data => {
        apiHostsResultRef.current = data
        setDbHosts(data)
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

        const hasScripts = tasks.some(t => t.status === 'enabled')
        setIsAlertsEnabled(hasScripts)
      } catch (e) {
        console.warn('Failed to check kapacitor tasks', e)
        setIsAlertsEnabled(false)
      }
    }
    checkKapacitorScripts()
  }, [source])

  let intervalID

  const handleManualRefresh = () => {
    setManualRefreshState({
      ...manualRefreshState,
      value: Date.now(),
    })
  }

  const handleFetch = async () => {
    if (isFetching) return

    const addon = links.addons?.find((a: any) => a.name === 'salt')
    const saltMasterUrl = addon?.url ?? ''
    const saltMasterToken = addon?.token ?? ''

    setIsFetching(true)

    try {
      // 버튼이 눌렸다는 시각적 피드백(로딩 스피너)을 위해 최소 500ms 대기
      await new Promise(resolve => setTimeout(resolve, 500))

      const influxHosts = tableData.map(r => r.host as string)
      const targetHosts = influxHosts.filter(
        h => !dbHosts.some(dbH => dbH.minionId === h)
      )

      if (targetHosts.length > 0) {
        await batchSyncAcceptedMinionsToDb(
          saltMasterUrl,
          saltMasterToken,
          targetHosts
        )

        const newHosts = await getHosts()
        apiHostsResultRef.current = newHosts
        setDbHosts(newHosts)
      }
    } catch (error) {
      console.error('Failed to sync salt minions', error)
    } finally {
      setIsFetching(false)
      setHasFetched(true)
    }
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

  const [frozenAlertStatus, setFrozenAlertStatus] = useState<any>(null)

  const {sendToAiChat, clear: clearAiContext} = useAiContext()

  const handleAiDiagnoseClick = useCallback(
    (host: string, rowData: Record<string, HostCellValue>) => {
      // One host per question for now: the agent cannot yet inspect several
      // servers in a single run. Clearing first means a second click replaces
      // the subject instead of piling onto it. To let selections accumulate
      // later, drop this call and send with autoSend false.
      clearAiContext()

      sendToAiChat({
        autoSend: true,
        skill: SERVER_ATTACH_SKILL,
        prompt: SERVER_DIAGNOSE_MESSAGE,
        context: {
          id: `host:${host}`,
          type: 'server',
          sourcePage: 'server-list',
          title: host,
          summary: buildServerContextSummary(rowData),
          payload: buildServerContextPayload(
            host,
            rowData,
            dbHosts,
            alertStatusMap
          ),
          capturedAt: Date.now(),
        },
      })
    },
    [clearAiContext, sendToAiChat, dbHosts, alertStatusMap]
  )

  const columns = useMemo(
    () =>
      serverListColumns({
        sourceID: source.id,
        chartMode: displayedChartMode,
        alertStatusMap,
        isAlertsEnabled,
        hosts: dbHosts,
        hasFetched,
        onStatusIconClick: (host: string) => {
          setSelectedAlertHost(host)
          setFrozenAlertStatus(alertStatusMap[host] ?? null)
          setIsAlertModalOpen(true)
        },
        onAiDiagnoseClick: handleAiDiagnoseClick,
        t,
      }),
    [
      source.id,
      displayedChartMode,
      alertStatusMap,
      isAlertsEnabled,
      dbHosts,
      hasFetched,
      handleAiDiagnoseClick,
      t,
    ]
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
  }, [
    cloudAutoRefresh,
    displayedChartMode,
    cloudTimeRange?.serverList?.lower,
    cloudTimeRange?.serverList?.upper,
    source,
  ])

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
      setIsError(false)
    } else {
      setIsRefreshing(true)
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

      // if (Array.isArray(apiHostsResultRef.current)) {
      //   const hosts = apiHostsResultRef.current as Host[]
      //   const allowedHosts = new Set(hosts.map(h => h.hostname))
      //   mergedData = mergedData.filter(row =>
      //     allowedHosts.has(row.host as string)
      //   )
      // }

      setTableData(mergedData)
      if (isModeSwitchFetch) {
        setDisplayedChartMode(chartMode)
      }
      setIsError(false)
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

      const alertDb = source?.telegraf || 'Default'

      const querySet = [
        {
          id: 'server-list-alert-status',
          text: getAlertQueryText(alertDb),
          db: alertDb,
        },
      ]

      const results = (await executeQueries(source, querySet, templates)) as any
      const result = results?.[0]?.value
      if (!result) return

      const series: any[] = result?.results?.[0]?.series ?? []

      const nextMap: AlertStatusMap = {}

      series.forEach(s => {
        const host: string = s?.tags?.host
        if (!host) return

        // URL Alert 관련 태그가 있는 시리즈 제외
        if (s?.tags?.url || s?.tags?.server) return

        const timeIndex = (s.columns ?? []).indexOf('time')
        const messageIndex = (s.columns ?? []).indexOf('message')
        const valueIndex = (s.columns ?? []).indexOf('value')
        const levelIndex = (s.columns ?? []).indexOf('level')
        const alertNameIndex = (s.columns ?? []).indexOf('alertName')
        const urlIndex = (s.columns ?? []).indexOf('url')

        const history: any[] = []
        const latestPerAlert: Record<string, AlertLevel> = {}

        ;(s.values ?? []).forEach((row: any[]) => {
          const eventTime: string | null =
            timeIndex >= 0 ? row[timeIndex] : null
          const messageStr: string = messageIndex >= 0 ? row[messageIndex] : ''
          const valueNum: number | undefined =
            valueIndex >= 0 ? row[valueIndex] : undefined
          const levelTag: string = levelIndex >= 0 ? row[levelIndex] : ''
          const alertNameStr: string =
            alertNameIndex >= 0 ? row[alertNameIndex] : ''
          const urlVal: string | null = urlIndex >= 0 ? row[urlIndex] : null

          if (!eventTime || !alertNameStr) return

          // URL Alert 데이터 거르기 (url 값 존재 또는 URL 알람 명칭/메시지일 경우)
          if (
            urlVal ||
            alertNameStr.toLowerCase().includes('url') ||
            messageStr.includes('URL 모니터링')
          ) {
            return
          }

          const level = mapInfluxLevel(levelTag)

          history.push({
            time: eventTime,
            level,
            alertName: alertNameStr,
            message: messageStr,
            value: valueNum,
          })

          // ORDER BY time DESC로 가져왔으므로, 처음 등장하는 alertName이 가장 최신 상태
          if (!latestPerAlert[alertNameStr]) {
            latestPerAlert[alertNameStr] = level
          }
        })

        // Table의 현재 아이콘 색상을 결정하기 위해, 각 알람의 '최신 상태' 중 가장 심각한 것을 고름
        let currentLevel = Object.values(latestPerAlert).reduce<AlertLevel>(
          (worst, level) =>
            LEVEL_PRIORITY[level] > LEVEL_PRIORITY[worst] ? level : worst,
          'normal'
        )

        nextMap[host] = {currentLevel, history}
      })

      setAlertStatusMap(nextMap)
    } catch (err) {
      console.error('Failed to fetch alert status data', err)
    }
  }

  const finalTableData = useMemo(() => {
    const combined = [...(tableData || [])]
    const existingHosts = new Set(combined.map(row => row.host))

    Object.keys(alertStatusMap).forEach(host => {
      if (!existingHosts.has(host)) {
        combined.push({host})
      }
    })

    return combined
  }, [tableData, alertStatusMap])

  return (
    <Page className="hosts-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Server List" />
        </Page.Header.Left>
        <Page.Header.Right>
          <AiAgentsButton />
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
      <DashboardsAiSplit inPresentationMode={inPresentationMode}>
        <Page.Contents fullWidth={true}>
          <div className="host-page-graph-table-container-wrapper host-page-graph-table-container">
            {!isError ? (
              <TableComponent
                data={finalTableData}
                bodyClassName="server-list-table"
                columns={columns}
                isLoading={isTableLoading}
                isSearchDisplay={true}
                isDotKey={true}
                enableSharedChartHover={displayedChartMode === 'line'}
                toprightRender={
                  <>
                    {isRefreshing && (
                      <LoadingDots className="server-list-loading-dots" />
                    )}
                    {isEditorRole && (
                      <div className="topright-render-container">
                        <Button
                          text={t('server_alert.add_event', '이벤트 추가')}
                          icon={IconFont.BellAdd}
                          size={ComponentSize.Small}
                          color={ComponentColor.Primary}
                          onClick={() => {
                            if (location && location.pathname && router) {
                              router.push({
                                pathname: location.pathname.replace(
                                  '/server-list',
                                  '/alert-setup'
                                ),
                                state: {returnTo: location.pathname},
                              })
                            }
                          }}
                        />
                      </div>
                    )}
                  </>
                }
                topLeftRender={
                  <>
                    <div className="server-list-topleft">
                      <Radio shape={ButtonShape.Default}>
                        <Radio.Button
                          id="host-chart-mode-gauge"
                          titleText="Gauge"
                          value="gauge"
                          active={pendingChartMode === 'gauge'}
                          onClick={() => {
                            if (
                              pendingChartMode !== 'gauge' &&
                              !isModeSwitching
                            ) {
                              setPendingChartMode('gauge')
                            }
                          }}
                        >
                          Gauge
                        </Radio.Button>
                        <Radio.Button
                          id="host-chart-mode-line"
                          titleText="Trend"
                          value="line"
                          active={pendingChartMode === 'line'}
                          onClick={() => {
                            if (pendingChartMode !== 'line' && !isModeSwitching) {
                              setPendingChartMode('line')
                            }
                          }}
                        >
                          Trend
                        </Radio.Button>
                      </Radio>
                      <div className="alert-status-summary-container">
                        <AlertStatusSummary
                          alertStatusMap={alertStatusMap}
                          tableData={tableData}
                          isAlertsEnabled={isAlertsEnabled}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        width: '100%',
                      }}
                    >
                      <Button
                        titleText={isFetching ? 'Fetching...' : 'Fetch'}
                        onClick={handleFetch}
                        icon={IconFont.SyncAlt}
                        shape={ButtonShape.Square}
                        color={ComponentColor.Default}
                        size={ComponentSize.Small}
                        status={
                          isFetching
                            ? ComponentStatus.Loading
                            : ComponentStatus.Default
                        }
                      />
                    </div>
                  </>
                }
              />
            ) : (
              <div className="empty-table-container">
                <div className="empty-table-content empty-table-retry">
                  <p>{t('hosts.failed_to_load')}</p>
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
      </DashboardsAiSplit>
      <AlertStatusModal
        source={source}
        isVisible={isAlertModalOpen}
        host={selectedAlertHost ?? ''}
        alertStatus={frozenAlertStatus}
        onClose={() => {
          setIsAlertModalOpen(false)
          setFrozenAlertStatus(null)
        }}
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
    auth: {me, isUsingAuth},
  } = state
  return {
    links,
    timeZone,
    cloudTimeRange,
    cloudAutoRefresh,
    inPresentationMode,
    me,
    isUsingAuth,
  }
}

const mdtp = dispatch => ({
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),

  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(NewHostsPage)
