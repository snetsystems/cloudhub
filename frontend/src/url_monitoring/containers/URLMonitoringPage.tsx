import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {Page} from 'src/reusable_ui'
import {Source, Links, RefreshRate, TimeZones, DataTableObject, Notification} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import * as appActions from 'src/shared/actions/app'
import TableComponent from 'src/device_management/components/TableComponent'
import {urlMonitoringColumns} from 'src/url_monitoring/constants/urlMonitoringColumns'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {CLOUD_TIME_RANGE, timeRanges} from 'src/shared/data/timeRanges'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import LoadingDots from 'src/shared/components/LoadingDots'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {executeQueries} from 'src/shared/apis/query'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {generateForHosts} from 'src/utils/tempVars'
import {buildUrlMonitoringQueries} from 'src/url_monitoring/constants/urlMonitoringQueries'
import {mergeResultsByUrlMonitoring} from 'src/url_monitoring/utils/mergeResultsByUrlMonitoring'
import {
  URLMonitoringFormSheet,
  URLMonitoringSheetMode,
} from 'src/url_monitoring/components/URLMonitoringFormSheet'
import {URLMonitoring, URLMonitoringTarget} from 'src/url_monitoring/types'
import {
  getURLMonitoring,
  deleteURLMonitoringTarget,
} from 'src/url_monitoring/apis'

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
  onChooseCloudAutoRefresh: (autoRefresh: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (timeRange: CloudTimeRange) => void
  setTimeZone: typeof appActions.setTimeZone
  notify: (n: Notification) => void
}

export function URLMonitoringPage({
  source,
  cloudAutoRefresh,
  cloudTimeRange,
  timeZone,
  onChooseCloudAutoRefresh,
  onChooseCloudTimeRange,
  setTimeZone,
  notify,
}: Props) {
  const [manualRefreshState, setManualRefreshState] = useState<ManualRefresh>({
    key: 'url-monitoring',
    value: Date.now(),
  })
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'success' | 'redirect' | 'failure'
  >('all')
  const [tableData, setTableData] = useState<DataTableObject[]>([])
  const [isTableLoading, setIsTableLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isError, setIsError] = useState(false)
  const requestIdRef = useRef(0)
  const pollIntervalRef = useRef<number | null>(null)

  const [urlMonitoringConfig, setUrlMonitoringConfig] =
    useState<URLMonitoring | null>(null)
  const [urlMonitoringConfigReady, setUrlMonitoringConfigReady] =
    useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const config = await getURLMonitoring()
      setUrlMonitoringConfig(config)
    } catch (e) {
      notify({
        type: 'error',
        icon: 'alert-triangle',
        duration: 10000,
        isHasHTML: false,
        message: `Failed to fetch URL monitoring config: ${e?.message ?? e}`,
      })
    } finally {
      setUrlMonitoringConfigReady(true)
    }
  }, [notify])

  const [urlSheet, setUrlSheet] = useState<{
    open: boolean
    mode: URLMonitoringSheetMode
    target: URLMonitoringTarget | null
  }>({open: false, mode: 'add', target: null})

  const openUrlSheet = useCallback(
    (mode: URLMonitoringSheetMode, row?: DataTableObject | null) => {
      const target =
        row && urlMonitoringConfig
          ? urlMonitoringConfig.targets.find(
              t => t.url === String(row.url ?? '')
            ) ?? null
          : null
      setUrlSheet({open: true, mode, target})
    },
    [urlMonitoringConfig]
  )

  const closeUrlSheet = useCallback(() => {
    setUrlSheet(s => ({...s, open: false}))
  }, [])

  const handleDeleteRow = useCallback(
    async (row: DataTableObject) => {
      const target = urlMonitoringConfig?.targets.find(
        t => t.url === String(row.url ?? '')
      )
      if (!target?.id) return
      try {
        await deleteURLMonitoringTarget(target.id)
        await fetchConfig()
      } catch (e) {
        notify({
          type: 'error',
          icon: 'alert-triangle',
          duration: 10000,
          isHasHTML: false,
          message: `Failed to delete URL monitoring target: ${e?.message ?? e}`,
        })
      }
    },
    [urlMonitoringConfig, fetchConfig, notify]
  )

  const influxMetricsByUrl = useMemo(() => {
    const map = new Map<string, DataTableObject>()
    for (const row of tableData) {
      const key = String(row.server ?? '')
      if (!key) continue
      map.set(key, row)
    }
    return map
  }, [tableData])

  const targetRows = useMemo<DataTableObject[]>(() => {
    if (!urlMonitoringConfig?.targets?.length) return []
    return urlMonitoringConfig.targets.map(target => {
      const influxRow = influxMetricsByUrl.get(String(target.url ?? '')) ?? {}
      return {
        ...influxRow,
        id: target.id,
        name: target.name,
        url: target.url,
        interval: target.interval,
      } as DataTableObject
    })
  }, [urlMonitoringConfig, influxMetricsByUrl])

  const columns = useMemo(
    () =>
      urlMonitoringColumns({
        onEditRow: row => openUrlSheet('edit', row),
        onCopyRow: row => openUrlSheet('copy', row),
        onDeleteRow: handleDeleteRow,
      }),
    [openUrlSheet, handleDeleteRow]
  )

  const getCodeNumber = (code: any): number | null => {
    if (typeof code === 'number') {
      return Number.isFinite(code) ? code : null
    }
    if (typeof code === 'string' && code.trim() !== '') {
      const parsed = Number(code)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  const statusCounts = useMemo(() => {
    const total = targetRows.length

    const success = targetRows.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      return n !== null && n >= 200 && n < 300
    }).length

    const redirect = targetRows.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      return n !== null && n >= 300 && n < 400
    }).length

    const failure = targetRows.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      return n !== null && n >= 400
    }).length

    return {total, success, redirect, failure}
  }, [targetRows])

  const displayTableData = useMemo(() => {
    if (statusFilter === 'all') return targetRows

    return targetRows.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      if (n === null) return false
      if (statusFilter === 'success') return n >= 200 && n < 300
      if (statusFilter === 'redirect') return n >= 300 && n < 400
      return n >= 400
    })
  }, [targetRows, statusFilter])

  const fetchTableData = useCallback(
    async (isSubscribed: boolean, silent = false) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      setIsError(false)
      if (!silent) {
        setIsRefreshing(true)
        setIsTableLoading(true)
      }

      if (!urlMonitoringConfigReady) {
        if (isSubscribed && requestId === requestIdRef.current && !silent) {
          setIsRefreshing(false)
          setIsTableLoading(false)
        }
        return
      }

      const targets = urlMonitoringConfig?.targets ?? []
      if (targets.length === 0) {
        if (isSubscribed && requestId === requestIdRef.current) {
          setTableData([])
          setIsError(false)
          if (!silent) {
            setIsTableLoading(false)
            setIsRefreshing(false)
          }
        }
        return
      }

      const selectedTimeRange =
        cloudTimeRange?.urlMonitoring ?? CLOUD_TIME_RANGE.urlMonitoring

      const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
        selectedTimeRange
      )
      const templates = [
        ...generateForHosts(source),
        dashboardTime,
        upperDashboardTime,
      ]

      const querySet = buildUrlMonitoringQueries().map(query => ({
        id: query.id,
        text: query.text,
        db: source.telegraf,
      }))

      try {
        const results = await executeQueries(source, querySet, templates)
        if (!isSubscribed || requestId !== requestIdRef.current) return

        const mergedData = mergeResultsByUrlMonitoring(results)
        setTableData(mergedData)
        setIsError(false)
      } catch (e) {
        console.error('Failed to fetch URL monitoring data', e)
        if (isSubscribed && requestId === requestIdRef.current) {
          setIsError(true)
        }
      } finally {
        if (
          isSubscribed &&
          requestId === requestIdRef.current &&
          !silent
        ) {
          setIsTableLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [
      source,
      cloudTimeRange?.urlMonitoring,
      urlMonitoringConfig,
      urlMonitoringConfigReady,
    ]
  )

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
      onChooseCloudTimeRange({urlMonitoring: {lower, upper}})
    } else {
      onChooseCloudTimeRange({
        urlMonitoring: timeRanges.find(tr => tr.lower === lower),
      })
    }
  }

  useEffect(() => {
    let isSubscribed = true
    fetchTableData(isSubscribed)
    return () => {
      isSubscribed = false
    }
  }, [
    fetchTableData,
    source.id,
    cloudTimeRange?.urlMonitoring?.lower,
    cloudTimeRange?.urlMonitoring?.upper,
    manualRefreshState.value,
    timeZone,
    urlMonitoringConfig,
    urlMonitoringConfigReady,
  ])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.urlMonitoring)
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (!!cloudAutoRefresh.urlMonitoring) {
      pollIntervalRef.current = window.setInterval(() => {
        fetchTableData(true, true)
      }, cloudAutoRefresh.urlMonitoring)
    }

    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh.urlMonitoring, fetchTableData])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  return (
    <Page className="hosts-page url-monitoring-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <Page.Title title="URL Monitoring" />
          </div>
        </Page.Header.Left>
        <Page.Header.Right>
          <SourceIndicator />
          <AutoRefreshDropdown
            onChoose={handleChooseAutoRefresh}
            selected={cloudAutoRefresh.urlMonitoring ?? 0}
            onManualRefresh={handleManualRefresh}
            customAutoRefreshOptions={getTimeOptionByGroup('urlMonitoring')}
            customAutoRefreshSelected={cloudAutoRefresh}
          />
          <TimeRangeDropdownComponent
            onChooseTimeRange={handleChooseTimeRange}
            selected={
              cloudTimeRange?.urlMonitoring ?? CLOUD_TIME_RANGE.urlMonitoring
            }
          />
          <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <div className="host-page-graph-table-container-wrapper">
          <div className="host-page-graph-table-container table-gauge-chart">
            {!isError ? (
              <>
                <TableComponent
                  data={displayTableData}
                  bodyClassName="url-monitoring-table"
                  columns={columns}
                  isLoading={isTableLoading}
                  isSearchDisplay={true}
                  searchPlaceholder="URL로 필터링..."
                  isDotKey={false}
                  enableSharedChartHover={true}
                  fancyScroll={true}
                  fancyScrollHeight="70vh"
                  topLeftRender={
                    <div className="url-monitoring-summary">
                      <button
                        type="button"
                        className={`url-monitoring-summary__item-button ${
                          statusFilter === 'all' ? 'active' : ''
                        }`}
                        // eslint-disable-next-line react/no-unused-class
                        data-status="all"
                        onClick={() => setStatusFilter('all')}
                      >
                        <span className="url-monitoring-summary__label url-monitoring-summary__label--total">
                          전체
                        </span>
                        <span className="url-monitoring-summary__count">
                          {statusCounts.total}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`url-monitoring-summary__item-button ${
                          statusFilter === 'success' ? 'active' : ''
                        }`}
                        data-status="success"
                        onClick={() => setStatusFilter('success')}
                      >
                        <span className="url-monitoring-summary__label url-monitoring-summary__label--success">
                          성공
                        </span>
                        <span className="url-monitoring-summary__count">
                          {statusCounts.success}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`url-monitoring-summary__item-button ${
                          statusFilter === 'redirect' ? 'active' : ''
                        }`}
                        data-status="redirect"
                        onClick={() => setStatusFilter('redirect')}
                      >
                        <span className="url-monitoring-summary__label url-monitoring-summary__label--redirect">
                          리다이렉트
                        </span>
                        <span className="url-monitoring-summary__count">
                          {statusCounts.redirect}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`url-monitoring-summary__item-button ${
                          statusFilter === 'failure' ? 'active' : ''
                        }`}
                        data-status="failure"
                        onClick={() => setStatusFilter('failure')}
                      >
                        <span className="url-monitoring-summary__label url-monitoring-summary__label--failure">
                          실패
                        </span>
                        <span className="url-monitoring-summary__count">
                          {statusCounts.failure}
                        </span>
                      </button>
                    </div>
                  }
                  toprightRender={
                    <div className="url-monitoring-panel-toolbar">
                      <div className="url-monitoring-panel-toolbar__actions">
                        <button
                          type="button"
                          className="url-monitoring-toolbar-btn url-monitoring-toolbar-btn--outline"
                          title="가져오기"
                          onClick={() => {
                            /* TODO: import */
                          }}
                        >
                          <span className="icon import" />
                          가져오기
                        </button>
                        <button
                          type="button"
                          className="url-monitoring-toolbar-btn url-monitoring-toolbar-btn--outline"
                          title="내보내기"
                          onClick={() => {
                            /* TODO: export */
                          }}
                        >
                          <span className="icon export" />
                          내보내기
                        </button>
                        <button
                          type="button"
                          className="url-monitoring-toolbar-btn url-monitoring-toolbar-btn--primary"
                          title="URL 추가하기"
                          onClick={() => openUrlSheet('add')}
                        >
                          <span className="icon plus" />
                          URL 추가하기
                        </button>
                      </div>
                      {isRefreshing ? (
                        <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
                      ) : null}
                    </div>
                  }
                />
              </>
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
      <URLMonitoringFormSheet
        isOpen={urlSheet.open}
        onClose={closeUrlSheet}
        mode={urlSheet.mode}
        initialTarget={urlSheet.target}
        onSaved={fetchConfig}
        notify={notify}
      />
    </Page>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh, cloudTimeRange, timeZone},
    },
    links,
  } = state
  return {
    links,
    timeZone,
    cloudTimeRange,
    cloudAutoRefresh,
  }
}

const mdtp = dispatch => ({
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(URLMonitoringPage)
