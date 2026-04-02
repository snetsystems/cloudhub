import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {Page} from 'src/reusable_ui'
import {Source, Links, RefreshRate, TimeZones} from 'src/types'
import {DataTableObject} from 'src/types'
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
import {urlMonitoringQueries} from 'src/url_monitoring/constants/urlMonitoringQueries'
import {mergeResultsByUrlMonitoring} from 'src/url_monitoring/utils/mergeResultsByUrlMonitoring'
import {
  applyMockUrlMonitoringMeta,
  createMockUrlMonitoringRows,
} from 'src/url_monitoring/utils/mockUrlMonitoringMeta'
import {
  UrlMonitoringFormSheet,
  UrlMonitoringSheetMode,
} from 'src/url_monitoring/components/UrlMonitoringFormSheet'

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
}

export function URLMonitoringPage({
  source,
  cloudAutoRefresh,
  cloudTimeRange,
  timeZone,
  onChooseCloudAutoRefresh,
  onChooseCloudTimeRange,
  setTimeZone,
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

  const [urlSheet, setUrlSheet] = useState<{
    open: boolean
    mode: UrlMonitoringSheetMode
    row: DataTableObject | null
  }>({open: false, mode: 'add', row: null})

  const openUrlSheet = useCallback(
    (mode: UrlMonitoringSheetMode, row?: DataTableObject | null) => {
      setUrlSheet({
        open: true,
        mode,
        row: row ?? null,
      })
    },
    []
  )

  const closeUrlSheet = useCallback(() => {
    setUrlSheet(s => ({...s, open: false}))
  }, [])

  const columns = useMemo(
    () =>
      urlMonitoringColumns({
        onEditRow: row => openUrlSheet('edit', row),
        onCopyRow: row => openUrlSheet('copy', row),
      }),
    [openUrlSheet]
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
    const total = tableData.length

    const success = tableData.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      return n !== null && n >= 200 && n < 300
    }).length

    const redirect = tableData.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      return n !== null && n >= 300 && n < 400
    }).length

    const failure = tableData.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      return n !== null && n >= 400
    }).length

    return {total, success, redirect, failure}
  }, [tableData])

  const displayTableData = useMemo(() => {
    if (statusFilter === 'all') return tableData

    return tableData.filter(row => {
      const n = getCodeNumber(row.last_http_response_code)
      if (n === null) return false
      if (statusFilter === 'success') return n >= 200 && n < 300
      if (statusFilter === 'redirect') return n >= 300 && n < 400
      return n >= 400
    })
  }, [tableData, statusFilter])

  const fetchTableData = async (isSubscribed: boolean) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setIsRefreshing(true)
    setIsError(false)
    setIsTableLoading(true)

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

    const querySet = urlMonitoringQueries.map(query => ({
      id: query.id,
      text: query.text,
      db: source.telegraf,
    }))

    try {
      const results = await executeQueries(source, querySet, templates)
      if (!isSubscribed || requestId !== requestIdRef.current) return

      const mergedData = mergeResultsByUrlMonitoring(results)

      // Influx 결과가 없으면(테스트 환경/백엔드 미연결 등) merge된 row도 0개가 되어
      // 화면이 비게 됩니다. 그 경우엔 목시드 rows를 넣습니다.
      const baseRows =
        mergedData.length > 0 ? mergedData : createMockUrlMonitoringRows()

      // 백엔드에서 method/server/url/region/status까지 함께 내려주기 전,
      // 화면에 필요한 컬럼들은 목데이터로 채웁니다.
      const withMockMeta = applyMockUrlMonitoringMeta(baseRows)
      setTableData(withMockMeta)
      setIsError(false)
    } catch (e) {
      console.error('Failed to fetch URL monitoring data', e)
      if (isSubscribed && requestId === requestIdRef.current) {
        setIsError(true)
      }
    } finally {
      if (isSubscribed && requestId === requestIdRef.current) {
        setIsTableLoading(false)
        setIsRefreshing(false)
      }
    }
  }

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
    source.id,
    cloudTimeRange?.urlMonitoring?.lower,
    cloudTimeRange?.urlMonitoring?.upper,
    manualRefreshState.value,
    timeZone,
  ])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.urlMonitoring)
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (!!cloudAutoRefresh.urlMonitoring) {
      pollIntervalRef.current = window.setInterval(() => {
        fetchTableData(true)
      }, cloudAutoRefresh.urlMonitoring)
    }

    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh.urlMonitoring])

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
                        // active 스타일을 상태별로 더 자연스럽게 보이게 하기 위함
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
      <UrlMonitoringFormSheet
        isOpen={urlSheet.open}
        onClose={closeUrlSheet}
        mode={urlSheet.mode}
        initialRow={urlSheet.row}
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
