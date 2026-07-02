import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import classnames from 'classnames'
import {useTranslation} from 'react-i18next'
import {withRouter, InjectedRouter} from 'react-router'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {
  Button,
  ComponentColor,
  ComponentSize,
  IconFont,
  ButtonShape,
  Page,
} from 'src/reusable_ui'
import {
  Source,
  RefreshRate,
  TimeZones,
  DataTableObject,
  Notification,
  ColumnInfo,
  AlignType,
  AlertGroupRule,
} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import * as appActions from 'src/shared/actions/app'
import TableComponent from 'src/device_management/components/TableComponent'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {CLOUD_TIME_RANGE, timeRanges} from 'src/shared/data/timeRanges'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {executeQueries} from 'src/shared/apis/query'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {generateForHosts} from 'src/utils/tempVars'
import {buildUrlMonitoringQueries} from 'src/url_monitoring/constants/urlMonitoringQueries'
import {mergeResultsByUrlMonitoring} from 'src/url_monitoring/utils/mergeResultsByUrlMonitoring'
import {
  URLAlertFormSheet,
  URLAlertFormSheetItem,
} from 'src/url_monitoring/components/URLAlertFormSheet'
import {
  URLAlertListItem,
  URLAlertStatusBadge,
  URLMonitoring,
} from 'src/url_monitoring/types'
import {getURLAlertList, getURLMonitoring, getUrlAlertRules} from 'src/url_monitoring/apis'

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatElapsedTime = (value: unknown): string => {
  const ms = toNumber(value)
  return ms === null ? '-' : `${Math.round(ms)}ms`
}

const normalizeUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(url => String(url).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }
  return []
}

const renderUrlAlertUrls = (urls: string[]) => {
  if (!urls.length) {
    return <span>--</span>
  }

  const [firstUrl, ...restUrls] = urls

  return (
    <div className="url-alert-url-cell" title={urls.join('\n')}>
      <span className="url-alert-url-cell__item">{firstUrl}</span>
      {restUrls.length > 0 && (
        <span className="url-alert-url-cell__more">
          {`외 ${restUrls.length}`}
        </span>
      )}
    </div>
  )
}

const renderAlertStatusBadges = (
  statuses: URLAlertStatusBadge[] | undefined,
  defaultStatuses: URLAlertStatusBadge[] = []
) => {
  const badges = statuses?.length ? statuses : defaultStatuses
  return (
    <div className="url-alert-status-badges">
      {badges.map(status => (
        <span
          key={status.kind}
          className={classnames(
            'url-alert-status-badge',
            `url-alert-status-badge--${status.kind}`
          )}
        >
          {status.label}
        </span>
      ))}
    </div>
  )
}

export interface ManualRefresh {
  key: string
  value: number
}

interface Props {
  source: Source
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  timeZone: TimeZones
  router: InjectedRouter
  onChooseCloudAutoRefresh: (autoRefresh: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (timeRange: CloudTimeRange) => void
  setTimeZone: typeof appActions.setTimeZone
  notify: (n: Notification) => void
}

export function URLAlertPage({
  source,
  cloudAutoRefresh,
  cloudTimeRange,
  timeZone,
  router,
  onChooseCloudAutoRefresh,
  onChooseCloudTimeRange,
  setTimeZone,
  notify,
}: Props) {
  const {t} = useTranslation()
  const [manualRefreshState, setManualRefreshState] = useState<ManualRefresh>({
    key: 'url-alert',
    value: Date.now(),
  })
  const [tableData, setTableData] = useState<DataTableObject[]>([])
  const [isTableLoading, setIsTableLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const requestIdRef = useRef(0)
  const pollIntervalRef = useRef<number | null>(null)
  const urlMonitoringConfigRef = useRef<URLMonitoring | null>(null)
  const hasSeenReadyUrlMonitoringConfigRef = useRef(false)

  const [
    urlMonitoringConfig,
    setUrlMonitoringConfig,
  ] = useState<URLMonitoring | null>(null)
  const [urlMonitoringConfigReady, setUrlMonitoringConfigReady] = useState(
    false
  )
  const [data, setData] = useState<URLAlertListItem[]>([])
  const [alertRules, setAlertRules] = useState<AlertGroupRule[]>([])
  const [defaultAlertStatuses, setDefaultAlertStatuses] = useState<
    URLAlertStatusBadge[]
  >([])
  urlMonitoringConfigRef.current = urlMonitoringConfig

  const [urlSheet, setUrlSheet] = useState<{
    open: boolean
    item: URLAlertFormSheetItem | null
  }>({open: false, item: null})
  const [elapsedSettingsByTargetId] = useState<
    Record<string, {enabled: boolean; ms: number | null; alertMessage?: string}>
  >({})

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

  const openUrlSheet = useCallback((row?: DataTableObject | null) => {
    if (!row) return

    const id = String(row.id ?? '').trim()
    if (!id) return

    setUrlSheet({
      open: true,
      item: {
        id,
        name: row.name as string | string[],
        urls: normalizeUrls(row.urls ?? row.url),
      },
    })
  }, [])

  const navigateToAlertSetting = useCallback(
    (ruleId?: string) => {
      if (!source?.id) return

      router.push({
        pathname: `/sources/${source.id}/url-monitoring/url-alert-setting`,
        ...(ruleId ? {query: {id: ruleId}} : {}),
        state: {returnTo: `/sources/${source.id}/url-monitoring/url-alert`},
      })
    },
    [router, source?.id]
  )

  const renderTopRight = () => (
    <Button
      text={t('url_alert.add_event')}
      icon={IconFont.Plus}
      size={ComponentSize.Small}
      color={ComponentColor.Primary}
      onClick={() => navigateToAlertSetting()}
    />
  )

  const closeUrlSheet = useCallback(() => {
    setUrlSheet(s => ({...s, open: false}))
  }, [])

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
      const elapsedOverride = target.id
        ? elapsedSettingsByTargetId[target.id]
        : undefined
      return {
        ...influxRow,
        id: target.id,
        name: target.name,
        urls: normalizeUrls(target.url),
        interval: target.interval,
        elapsedTimeEnabled:
          elapsedOverride?.enabled ?? target.elapsedTimeEnabled ?? false,
        elapsedTimeMs: elapsedOverride?.ms ?? target.elapsedTimeMs ?? null,
        elapsedTimeAlertMessage:
          elapsedOverride?.alertMessage ?? target.elapsedTimeAlertMessage ?? '',
      } as DataTableObject
    })
  }, [urlMonitoringConfig, influxMetricsByUrl, elapsedSettingsByTargetId])

  const filteredData = useMemo<DataTableObject[]>(() => {
    if (alertRules.length > 0) {
      return alertRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        urls: [],
        alertStatuses: defaultAlertStatuses,
        elapsedTimeEnabled: false,
        elapsedTimeMs: null,
      }))
    }

    const dataById = new Map(data.map(item => [item.id, item]))
    const dataByUrl = new Map<string, URLAlertListItem>()
    for (const item of data) {
      for (const url of item.urls) {
        dataByUrl.set(url, item)
      }
    }

    if (targetRows.length > 0) {
      return targetRows.map(row => {
        const rowUrls = normalizeUrls(row.urls ?? row.url)
        const matchedItem =
          dataById.get(String(row.id ?? '')) ??
          rowUrls.map(url => dataByUrl.get(url)).find(Boolean)
        return {
          ...row,
          name: matchedItem?.name ?? row.name,
          urls: rowUrls,
          alertStatuses: matchedItem?.alertStatuses ?? defaultAlertStatuses,
        }
      })
    }

    return data.map(item => ({
      id: item.id,
      name: item.name,
      urls: item.urls,
      alertStatuses: item.alertStatuses,
      elapsedTimeEnabled: item.elapsedTimeEnabled,
      elapsedTimeMs: item.elapsedTimeMs,
    }))
  }, [alertRules, targetRows, data, defaultAlertStatuses])

  const columns: ColumnInfo[] = useMemo(
    () => [
      {
        key: 'id',
        name: 'Alert Name',
        render: (_value: unknown, row: DataTableObject) =>
          String(row.name ?? row.id ?? ''),
      },
      {
        key: 'name',
        name: 'Request / URL',
        className: 'url-alert-url-td',
        onClick: (row: DataTableObject) => openUrlSheet(row),
        options: {
          thead: {className: 'url-alert-url-th'},
        },
        render: (value: unknown, row: DataTableObject) =>
          renderUrlAlertUrls(normalizeUrls(value ?? row.urls ?? row.url)),
      },
      {
        key: 'alertStatuses',
        name: 'Status',
        align: AlignType.CENTER,
        options: {
          thead: {
            align: AlignType.CENTER,
            className: 'url-alert-status-th',
          },
        },
        render: (value: unknown) =>
          renderAlertStatusBadges(
            value as URLAlertStatusBadge[] | undefined,
            defaultAlertStatuses
          ),
      },
      {
        key: 'elapsedTimeMs',
        name: 'Avg. response time (ms)',
        render: (_value: unknown, row: DataTableObject) => {
          if (!row.elapsedTimeEnabled) {
            return <span>비활성</span>
          }
          return <span>{formatElapsedTime(row.elapsedTimeMs)}</span>
        },
      },
      {
        key: 'settings',
        name: '',
        align: AlignType.CENTER,
        options: {
          thead: {
            align: AlignType.CENTER,
            className: 'url-alert-actions-th',
          },
        },
        render: (_value: unknown, row: DataTableObject) => (
          <div className="url-alert-row-actions">
            <Button
              icon={IconFont.Pencil}
              size={ComponentSize.ExtraSmall}
              shape={ButtonShape.Square}
              color={ComponentColor.Default}
              onClick={e => {
                e.stopPropagation()
                const ruleId = String(row.id ?? '').trim()
                if (ruleId) {
                  navigateToAlertSetting(ruleId)
                }
              }}
            />
          </div>
        ),
      },
    ],
    [openUrlSheet, defaultAlertStatuses, navigateToAlertSetting]
  )

  const fetchTableData = useCallback(
    async (isSubscribed: boolean, silent = false) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      setIsError(false)
      if (!silent) {
        setIsTableLoading(true)
      }

      if (!urlMonitoringConfigReady) {
        if (isSubscribed && requestId === requestIdRef.current && !silent) {
          setIsTableLoading(false)
        }
        return
      }

      const targets = urlMonitoringConfigRef.current?.targets ?? []
      if (targets.length === 0) {
        if (isSubscribed && requestId === requestIdRef.current) {
          setTableData([])
          setIsError(false)
          setIsTableLoading(false)
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
        if (isSubscribed && requestId === requestIdRef.current && !silent) {
          setIsTableLoading(false)
        }
      }
    },
    [source, cloudTimeRange?.urlMonitoring, urlMonitoringConfigReady]
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
  ])

  useEffect(() => {
    if (!urlMonitoringConfigReady) {
      return
    }
    let isSubscribed = true
    if (hasSeenReadyUrlMonitoringConfigRef.current) {
      void fetchTableData(isSubscribed, true)
    } else {
      hasSeenReadyUrlMonitoringConfigRef.current = true
    }
    return () => {
      isSubscribed = false
    }
  }, [urlMonitoringConfig, urlMonitoringConfigReady, fetchTableData])

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

  const fetchData = useCallback(async () => {
    try {
      const [alertList, rules] = await Promise.all([
        getURLAlertList(),
        getUrlAlertRules(),
      ])
      setDefaultAlertStatuses(alertList.defaultAlertStatuses)
      setData(alertList.items)
      setAlertRules(rules)
    } catch {
      setDefaultAlertStatuses([])
      setData([])
      setAlertRules([])
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <Page className="hosts-page url-alert-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <div className="url-alert-page__title-wrap">
            <Page.Title title="URL Alert" />
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
          <TimeRangeDropdown
            onChooseTimeRange={handleChooseTimeRange}
            selected={
              cloudTimeRange?.urlMonitoring ?? CLOUD_TIME_RANGE.urlMonitoring
            }
          />
          <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents scrollable={false} fullWidth={true}>
        <div className="url-page-graph-table-container-wrapper">
          {!isError ? (
            <TableComponent
              columns={columns}
              data={filteredData}
              bodyClassName="url-alert-table"
              isLoading={isTableLoading}
              isSearchDisplay={true}
              searchPlaceholder="Filter by URL..."
              isDotKey={false}
              isMultiSelect={false}
              toprightRender={renderTopRight()}
            />
          ) : (
            <div className="empty-table-container">
              <div className="empty-table-content">
                <p>No data available</p>
              </div>
            </div>
          )}
        </div>
      </Page.Contents>
      <URLAlertFormSheet
        isOpen={urlSheet.open}
        onClose={closeUrlSheet}
        item={urlSheet.item}
      />
    </Page>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh, cloudTimeRange, timeZone},
    },
  } = state
  return {
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

export default connect(mstp, mdtp, null)(withRouter(URLAlertPage))
