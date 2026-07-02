import React, {useCallback, useEffect, useMemo, useState} from 'react'
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
  SlideToggle,
} from 'src/reusable_ui'
import {DataTableObject, Notification, ColumnInfo, AlignType} from 'src/types'
import {
  notifyUrlMonitoringDeleted,
  notifyError,
} from 'src/shared/copy/notifications'
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
import ConfirmButton from 'src/shared/components/ConfirmButton'
import TableComponent from 'src/device_management/components/TableComponent'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import {
  URLAlertListItem,
  URLAlertStatusBadge,
  URLMonitoring,
} from 'src/url_monitoring/types'
import {
  getURLAlertList,
  getURLMonitoring,
  deleteURLMonitoringTarget,
} from 'src/url_monitoring/apis'
import {getAlertGroupRules, updateAlertGroupRule} from 'src/alert_group/apis'
import {AlertGroupRule, OPERATOR_SYMBOLS} from 'src/types'
import {URLAlertUrlCell} from 'src/url_monitoring/components/URLAlertUrlCell'
import AlertSeverityFilter, {
  AlertSeverityFilterValue,
} from 'src/shared/components/AlertSeverityFilter'

interface Props {
  router: InjectedRouter
  notify: (n: Notification) => void
}

interface URLAlertPageData {
  config: URLMonitoring | null
  items: URLAlertListItem[]
  defaultAlertStatuses: URLAlertStatusBadge[]
  alertRulesById: Record<string, AlertGroupRule>
  stubAlertRulesById: Record<string, AlertGroupRule>
}

const getOperatorSymbol = (op: string): string => {
  if (!op) {
    return ''
  }
  return OPERATOR_SYMBOLS[op] || op
}

const getRowAlertRule = (
  row: DataTableObject,
  alertRulesById: Record<string, AlertGroupRule>,
  stubAlertRulesById: Record<string, AlertGroupRule>
): AlertGroupRule | undefined => {
  const alertRuleId = String(row.alertRuleId ?? '').trim()
  if (!alertRuleId) return undefined
  return alertRulesById[alertRuleId] ?? stubAlertRulesById[alertRuleId]
}

const urlHostname = (url: string): string => {
  const trimmed = String(url ?? '').trim()
  if (!trimmed) return ''
  try {
    return new URL(trimmed).hostname.toLowerCase()
  } catch {
    return trimmed.toLowerCase()
  }
}

const findMatchedAlertListItem = (
  rowId: string,
  rowUrls: string[],
  data: URLAlertListItem[],
  dataById: Map<string, URLAlertListItem>,
  dataByUrl: Map<string, URLAlertListItem>
): URLAlertListItem | undefined => {
  const byId = dataById.get(rowId)
  if (byId) return byId

  for (const url of rowUrls) {
    const exact = dataByUrl.get(url)
    if (exact) return exact
  }

  const rowHosts = new Set(rowUrls.map(urlHostname).filter(Boolean))
  if (!rowHosts.size) return undefined

  return data.find(item =>
    item.urls.some(itemUrl => rowHosts.has(urlHostname(itemUrl)))
  )
}

const enrichRowWithAlertRule = (
  row: DataTableObject,
  matchedItem: URLAlertListItem | undefined,
  alertRulesById: Record<string, AlertGroupRule>,
  stubAlertRulesById: Record<string, AlertGroupRule>
): DataTableObject => {
  const alertRuleId = String(
    row.alertRuleId ?? matchedItem?.alertRuleId ?? ''
  ).trim()
  const rule = alertRuleId
    ? alertRulesById[alertRuleId] ?? stubAlertRulesById[alertRuleId]
    : undefined

  return {
    ...row,
    alertRuleId: alertRuleId || row.alertRuleId,
    trigger: rule?.trigger ?? row.trigger,
    triggerValues: rule?.values ?? row.triggerValues,
  }
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

const renderAlertTriggerCell = (
  trigger: string | undefined,
  values: AlertGroupRule['values'] | undefined,
  t: (key: string, fallback?: string) => string
) => {
  const normalizedTrigger = trigger || 'threshold'

  if (normalizedTrigger === 'threshold') {
    return (
      <div className="server-alert-trigger-cell">
        <span className="server-alert-trigger-main">
          {t('alert_group_rule.threshold', 'Threshold')}
        </span>
      </div>
    )
  }

  if (normalizedTrigger === 'relative') {
    const shift = values?.shift || ''
    const changeVal = values?.change || 'change'
    const changeText =
      changeVal === '% change'
        ? t('server_alert.pct_change', '변화율')
        : t('server_alert.amt_change', '변화량')
    const optionText = shift ? `${shift} ${changeText}` : changeText

    return (
      <div className="server-alert-trigger-cell">
        <span className="server-alert-trigger-main">
          {t('alert_group_rule.relative', 'Relative')}
        </span>
        <span className="server-alert-trigger-sub">{optionText}</span>
      </div>
    )
  }

  return <span>-</span>
}

const INITIAL_PAGE_DATA: URLAlertPageData = {
  config: null,
  items: [],
  defaultAlertStatuses: [],
  alertRulesById: {},
  stubAlertRulesById: {},
}

export function URLAlertPage({router, notify}: Props) {
  const {t} = useTranslation()
  const [isTableLoading, setIsTableLoading] = useState(true)

  const [pageData, setPageData] = useState<URLAlertPageData>(INITIAL_PAGE_DATA)
  const [activeOverridesById, setActiveOverridesById] = useState<
    Record<string, boolean>
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
  const [activeFilter, setActiveFilter] = useState<AlertSeverityFilterValue>(
    'all'
  )

  const {
    config: urlMonitoringConfig,
    items: data,
    defaultAlertStatuses,
    alertRulesById,
    stubAlertRulesById,
  } = pageData

  const fetchConfig = useCallback(async () => {
    try {
      const config = await getURLMonitoring()
      setPageData(prev => ({...prev, config}))
    } catch (e) {
      notify({
        type: 'error',
        icon: 'alert-triangle',
        duration: 10000,
        isHasHTML: false,
        message: `Failed to fetch URL monitoring config: ${e?.message ?? e}`,
      })
    }
  }, [notify])

  const renderTopLeft = () => (
    <AlertSeverityFilter
      activeFilter={activeFilter}
      onChange={setActiveFilter}
      totalCount={totalCount}
      warningCount={warningCount}
      criticalCount={criticalCount}
    />
  )
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

  const resolveRowActive = useCallback(
    (
      rowId: string,
      alertRuleId?: string,
      matchedItem?: URLAlertListItem
    ): boolean => {
      const ruleId = String(alertRuleId ?? '').trim()
      if (ruleId && alertRulesById[ruleId]) {
        return alertRulesById[ruleId].active
      }
      if (ruleId && stubAlertRulesById[ruleId]) {
        return stubAlertRulesById[ruleId].active
      }
      if (rowId && rowId in activeOverridesById) {
        return activeOverridesById[rowId]
      }
      return matchedItem?.active ?? true
    },
    [alertRulesById, stubAlertRulesById, activeOverridesById]
  )

  const handleToggleActive = useCallback(
    async (row: DataTableObject) => {
      const targetId = String(row.id ?? '').trim()
      if (!targetId) return

      const alertRuleId = String(row.alertRuleId ?? '').trim()
      const serverRule = alertRuleId ? alertRulesById[alertRuleId] : undefined
      const stubRule = alertRuleId ? stubAlertRulesById[alertRuleId] : undefined
      const nextActive = !Boolean(row.active)

      if (serverRule?.id) {
        setPageData(prev => ({
          ...prev,
          alertRulesById: {
            ...prev.alertRulesById,
            [serverRule.id!]: {...serverRule, active: nextActive},
          },
        }))
        try {
          const updatedRule = await updateAlertGroupRule(serverRule.id, {
            ...serverRule,
            active: nextActive,
          })
          setPageData(prev => ({
            ...prev,
            alertRulesById: {
              ...prev.alertRulesById,
              [serverRule.id!]: updatedRule,
            },
          }))
        } catch (error) {
          console.error('Failed to update URL alert active state', error)
          setPageData(prev => ({
            ...prev,
            alertRulesById: {
              ...prev.alertRulesById,
              [serverRule.id!]: serverRule,
            },
          }))
          notify(
            notifyError(
              t('server_alert.update_failed', '상태 변경에 실패했습니다.')
            )
          )
        }
        return
      }

      if (stubRule?.id) {
        setPageData(prev => ({
          ...prev,
          stubAlertRulesById: {
            ...prev.stubAlertRulesById,
            [stubRule.id!]: {...stubRule, active: nextActive},
          },
        }))
        return
      }

      setPageData(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === targetId) {
            return {...item, active: nextActive}
          }
          const rowUrls = normalizeUrls(row.urls ?? row.url)
          if (
            rowUrls.length > 0 &&
            item.urls.some(url => rowUrls.includes(url))
          ) {
            return {...item, active: nextActive}
          }
          return item
        }),
      }))
      setActiveOverridesById(prev => ({...prev, [targetId]: nextActive}))
    },
    [alertRulesById, stubAlertRulesById, notify, t]
  )

  const handleDelete = useCallback(
    async (row: DataTableObject) => {
      const targetId = String(row.id ?? '').trim()
      if (!targetId) return

      const hasTarget = urlMonitoringConfig?.targets?.some(
        target => String(target.id ?? '') === targetId
      )

      try {
        if (hasTarget) {
          await deleteURLMonitoringTarget(targetId)
          await fetchConfig()
        }
        setPageData(prev => ({
          ...prev,
          items: prev.items.filter(item => item.id !== targetId),
        }))
        notify(notifyUrlMonitoringDeleted())
      } catch (e) {
        notify({
          type: 'error',
          icon: 'alert-triangle',
          duration: 10000,
          isHasHTML: false,
          message: `Failed to delete URL alert: ${e?.message ?? e}`,
        })
      }
    },
    [urlMonitoringConfig, fetchConfig, notify]
  )

  const targetRows = useMemo<DataTableObject[]>(() => {
    if (!urlMonitoringConfig?.targets?.length) return []
    return urlMonitoringConfig.targets.map(target => {
      return {
        id: target.id,
        name: target.name,
        urls: normalizeUrls(target.url),
        interval: target.interval,
        alertRuleId: target.alertRuleId,
        elapsedTimeEnabled: target.elapsedTimeEnabled ?? false,
        elapsedTimeMs: target.elapsedTimeMs ?? null,
        elapsedTimeAlertMessage: target.elapsedTimeAlertMessage ?? '',
      } as DataTableObject
    })
  }, [urlMonitoringConfig])

  const tableRows = useMemo<DataTableObject[]>(() => {
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
        const rowId = String(row.id ?? '')
        const matchedItem = findMatchedAlertListItem(
          rowId,
          rowUrls,
          data,
          dataById,
          dataByUrl
        )
        const resolvedAlertRuleId = String(
          row.alertRuleId ?? matchedItem?.alertRuleId ?? ''
        )
        const baseRow = enrichRowWithAlertRule(
          {
            ...row,
            name: matchedItem?.name ?? row.name,
            urls: rowUrls,
            alertRuleId: resolvedAlertRuleId || row.alertRuleId,
            alertStatuses: matchedItem?.alertStatuses ?? defaultAlertStatuses,
            occurrenceCount: matchedItem?.occurrenceCount ?? 1,
            pauseSeconds: matchedItem?.pauseSeconds ?? 0,
          },
          matchedItem,
          alertRulesById,
          stubAlertRulesById
        )
        return {
          ...baseRow,
          active: resolveRowActive(rowId, resolvedAlertRuleId, matchedItem),
        }
      })
    }

    return data.map(item => {
      const baseRow = enrichRowWithAlertRule(
        {
          id: item.id,
          name: item.name,
          urls: item.urls,
          alertStatuses: item.alertStatuses,
          alertRuleId: item.alertRuleId,
          elapsedTimeEnabled: item.elapsedTimeEnabled,
          elapsedTimeMs: item.elapsedTimeMs,
          occurrenceCount: item.occurrenceCount ?? 1,
          pauseSeconds: item.pauseSeconds ?? 0,
        },
        item,
        alertRulesById,
        stubAlertRulesById
      )
      return {
        ...baseRow,
        active: resolveRowActive(item.id, item.alertRuleId, item),
      }
    })
  }, [
    targetRows,
    data,
    defaultAlertStatuses,
    resolveRowActive,
    alertRulesById,
    stubAlertRulesById,
  ])

  const totalCount = tableRows.length
  const warningCount = tableRows.filter(row =>
    getRowAlertRule(row, alertRulesById, stubAlertRulesById)?.conditions?.some(
      c => c.level === 'warning' && c.enabled
    )
  ).length
  const criticalCount = tableRows.filter(row =>
    getRowAlertRule(row, alertRulesById, stubAlertRulesById)?.conditions?.some(
      c => c.level === 'critical' && c.enabled
    )
  ).length

  const filteredTableRows = useMemo(() => {
    if (activeFilter === 'warning') {
      return tableRows.filter(row =>
        getRowAlertRule(
          row,
          alertRulesById,
          stubAlertRulesById
        )?.conditions?.some(c => c.level === 'warning' && c.enabled)
      )
    }
    if (activeFilter === 'critical') {
      return tableRows.filter(row =>
        getRowAlertRule(
          row,
          alertRulesById,
          stubAlertRulesById
        )?.conditions?.some(c => c.level === 'critical' && c.enabled)
      )
    }
    return tableRows
  }, [tableRows, activeFilter, alertRulesById, stubAlertRulesById])
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
        key: 'active',
        name: t('server_alert.active', '활성'),
        render: (value: boolean, row: DataTableObject) => (
          <div onClick={e => e.stopPropagation()}>
            <SlideToggle
              active={value}
              size={ComponentSize.ExtraSmall}
              onChange={() => handleToggleActive(row)}
            />
          </div>
        ),
      },
      {
        key: 'id',
        name: t('url_alert.event_name', '이벤트 이름'),
        name: 'Alert Name',
        render: (_value: unknown, row: DataTableObject) =>
          String(row.name ?? row.id ?? ''),
      },
      {
        key: 'name',
        name: 'Request / URL',
        className: 'url-alert-url-td',
        options: {
          thead: {className: 'url-alert-url-th'},
        },
        render: (value: unknown, row: DataTableObject) => (
          <URLAlertUrlCell
            name={value ?? row.name}
            urls={normalizeUrls(row.urls ?? row.url)}
          />
        ),
      },
      {
        key: 'alertStatuses',
        name: t('url_alert.status', '상태'),
        options: {
          thead: {
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
        key: 'trigger',
        name: t('server_alert.trigger', '조건 방식'),
        options: {
          thead: {className: 'url-alert-trigger-th'},
        },
        render: (_value: unknown, row: DataTableObject) => {
          const rule = getRowAlertRule(row, alertRulesById, stubAlertRulesById)
          const trigger = rule?.trigger ?? String(row.trigger ?? '')
          if (!trigger) {
            return <span>-</span>
          }
          return renderAlertTriggerCell(
            trigger,
            rule?.values ?? (row.triggerValues as AlertGroupRule['values']),
            t
          )
        },
      },
      {
        key: 'conditions',
        name: t('server_alert.rule', '규칙'),
        render: (_value: unknown, row: DataTableObject) => {
          const rule = getRowAlertRule(row, alertRulesById, stubAlertRulesById)
          const value = rule?.conditions

          if (!value || value.length === 0) {
            return (
              <div className="url-alert-rule-container">
                <span>-</span>
              </div>
            )
          }

          const critical = value.find(c => c.level === 'critical' && c.enabled)
          const warning = value.find(c => c.level === 'warning' && c.enabled)

          return (
            <div className="url-alert-rule-container">
              <span>
                {rule?.measurement
                  ? `${rule.measurement} - ${rule.field}`
                  : '-'}
              </span>
              {critical && (
                <span className="url-alert-rule-critical">
                  ● Critical {getOperatorSymbol(critical.operator)}{' '}
                  {critical.value}
                </span>
              )}
              {warning && (
                <span className="url-alert-rule-warning">
                  ● Warning {getOperatorSymbol(warning.operator)}{' '}
                  {warning.value}
                </span>
              )}
            </div>
          )
        },
      },
      {
        key: 'occurrenceCount',
        name: t('server_alert.alarm_count', '알람 횟수'),
      },
      {
        key: 'pauseSeconds',
        name: t('server_alert.pause', '일시중지'),
        render: (value: number) => (
          <span>
            {value > 0
              ? t('server_alert.in_use', '사용중')
              : t('server_alert.not_in_use', '사용 안함')}
          </span>
        ),
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
        render: (_value: unknown, row: DataTableObject) => (
          <div className="url-alert-row-actions">
            <Button
              icon={IconFont.Pencil}
              size={ComponentSize.ExtraSmall}
              shape={ButtonShape.Square}
              color={ComponentColor.Default}
              titleText={t('url_alert.edit', 'Edit')}
              onClick={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                const ruleId = String(row.id ?? '').trim()
                if (ruleId) {
                  navigateToAlertSetting(ruleId)
                }
              }}
            />
            <ConfirmButton
              icon={IconFont.Trash}
              size="btn-xs"
              square={true}
              type="btn-danger"
              isEventStopPropagation={true}
              confirmText={t('server_alert.delete', '삭제')}
              confirmAction={() => handleDelete(row)}
            />
          </div>
        ),
      },
    ],
    [
      defaultAlertStatuses,
      alertRulesById,
      stubAlertRulesById,
      t,
      handleDelete,
      handleToggleActive,
    ]
  )
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
      const alertList = await getURLAlertList()
      const nextStubRules = alertList.alertRules?.length
        ? Object.fromEntries(
            alertList.alertRules
              .filter(rule => rule.id)
              .map(rule => [rule.id!, rule])
          )
        : {}
      setPageData(prev => ({
        ...prev,
        defaultAlertStatuses: alertList.defaultAlertStatuses,
        items: alertList.items,
        stubAlertRulesById: nextStubRules,
      }))
      const [alertList, rules] = await Promise.all([
        getURLAlertList(),
        getUrlAlertRules(),
      ])
      setDefaultAlertStatuses(alertList.defaultAlertStatuses)
      setData(alertList.items)
      setAlertRules(rules)
    } catch {
      setPageData(prev => ({
        ...prev,
        defaultAlertStatuses: [],
        items: [],
        stubAlertRulesById: {},
      }))
    } finally {
      setIsTableLoading(false)
      setDefaultAlertStatuses([])
      setData([])
      setAlertRules([])
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let isSubscribed = true
    getAlertGroupRules()
      .then(rules => {
        if (!isSubscribed) return
        setPageData(prev => ({
          ...prev,
          alertRulesById: Object.fromEntries(
            rules.filter(rule => rule.id).map(rule => [rule.id!, rule])
          ),
        }))
      })
      .catch(error => {
        console.error('Failed to fetch alert group rules for URL alert', error)
      })
    return () => {
      isSubscribed = false
    }
  }, [])

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
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents scrollable={false} fullWidth={true}>
        <div className="url-page-graph-table-container-wrapper">
          <TableComponent
            tableTitle={`${filteredTableRows.length} ${t(
              'url_alert.table_title',
              'URL Alerts'
            )}`}
            columns={columns}
            data={filteredTableRows}
            bodyClassName="url-alert-table"
            isLoading={isTableLoading}
            isSearchDisplay={true}
            searchPlaceholder="Filter by URL..."
            isDotKey={false}
            isMultiSelect={false}
            topLeftRender={renderTopLeft()}
            toprightRender={renderTopRight()}
          />
        </div>
      </Page.Contents>
    </Page>
  )
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(null, mdtp, null)(withRouter(URLAlertPage))
