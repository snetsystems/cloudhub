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
import {
  Source,
  ColumnInfo,
  AlignType,
  AlertGroupRule,
  AlertCondition,
  OPERATOR_SYMBOLS,
  urlErrorConfigToStatusFilters,
} from 'src/types'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifySuccess, notifyError} from 'src/shared/copy/notifications'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import TableComponent from 'src/device_management/components/TableComponent'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import {
  URLAlertStatusBadge,
  URLMonitoringTarget,
} from 'src/url_monitoring/types'
import {
  getUrlAlertListData,
  isMockUrlAlertRuleId,
} from 'src/url_monitoring/apis'
import {updateAlertGroupRule, deleteAlertGroupRule} from 'src/alert_group/apis'
import {URLAlertUrlCell} from 'src/url_monitoring/components/URLAlertUrlCell'
import AlertSeverityFilter, {
  AlertSeverityFilterValue,
} from 'src/shared/components/AlertSeverityFilter'

interface Props {
  router: InjectedRouter
  source: Source
  notify: (n: any) => void
}

const getOperatorSymbol = (op: string): string => {
  if (!op) {
    return ''
  }
  return OPERATOR_SYMBOLS[op] || op
}

const getRuleStatusBadges = (
  rule: AlertGroupRule,
  unknownLabel: string
): URLAlertStatusBadge[] => {
  const statusTarget = rule.targets?.find(
    target => target.field === 'result_code'
  )
  const filters =
    rule.urlStatusFilters ??
    (rule.urlErrorConfig
      ? urlErrorConfigToStatusFilters(rule.urlErrorConfig)
      : statusTarget?.urlErrorConfig
      ? urlErrorConfigToStatusFilters(statusTarget.urlErrorConfig)
      : undefined)

  if (!filters) {
    return []
  }

  const badges: URLAlertStatusBadge[] = []
  if (filters.client4xx) badges.push({kind: '4xx', label: '4XX'})
  if (filters.server5xx) badges.push({kind: '5xx', label: '5XX'})
  if (filters.unknown) badges.push({kind: 'unknown', label: unknownLabel})
  return badges
}

const renderAlertStatusBadges = (statuses: URLAlertStatusBadge[]) => {
  if (!statuses.length) {
    return <span>-</span>
  }
  return (
    <div className="url-alert-status-badges">
      {statuses.map(status => (
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

export function URLAlertPage({router, source, notify}: Props) {
  const {t} = useTranslation()
  const [isTableLoading, setIsTableLoading] = useState(true)
  const [rules, setRules] = useState<AlertGroupRule[]>([])
  const [targetsById, setTargetsById] = useState<
    Record<string, URLMonitoringTarget>
  >({})
  const [activeFilter, setActiveFilter] = useState<AlertSeverityFilterValue>(
    'all'
  )

  const unknownLabel = t('url_alert.status_unknown', '알수없음')

  const fetchRules = useCallback(async () => {
    setIsTableLoading(true)
    try {
      const {rules: nextRules, targets} = await getUrlAlertListData()
      const map: Record<string, URLMonitoringTarget> = {}
      for (const target of targets) {
        if (target.id) {
          map[target.id] = target
        }
      }
      setRules(nextRules)
      setTargetsById(map)
    } catch (error) {
      console.error('Failed to fetch URL alert list', error)
      setRules([])
      setTargetsById({})
    } finally {
      setIsTableLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

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

  const handleToggleActive = useCallback(
    async (rule: AlertGroupRule) => {
      if (!rule || !rule.id) return

      if (isMockUrlAlertRuleId(rule.id)) {
        setRules(prev =>
          prev.map(item =>
            item.id === rule.id ? {...item, active: !item.active} : item
          )
        )
        return
      }

      try {
        const updatedRule = await updateAlertGroupRule(rule.id, {
          ...rule,
          active: !rule.active,
        })
        setRules(prev =>
          prev.map(item => (item.id === rule.id ? updatedRule : item))
        )
      } catch (error) {
        console.error('Failed to update URL alert active state', error)
        notify(
          notifyError(
            t('server_alert.update_failed', '상태 변경에 실패했습니다.')
          )
        )
      }
    },
    [notify, t]
  )

  const handleDelete = useCallback(
    async (rule: AlertGroupRule) => {
      if (!rule || !rule.id) return

      if (isMockUrlAlertRuleId(rule.id)) {
        setRules(prev => prev.filter(item => item.id !== rule.id))
        notify(
          notifySuccess(
            t('server_alert.delete_success', '이벤트 그룹 규칙을 삭제했습니다.')
          )
        )
        return
      }

      try {
        await deleteAlertGroupRule(rule.id)
        await fetchRules()
        notify(
          notifySuccess(
            t('server_alert.delete_success', '이벤트 그룹 규칙을 삭제했습니다.')
          )
        )
      } catch (error) {
        console.error('Failed to delete URL alert rule', error)
        notify(
          notifyError(
            t(
              'server_alert.delete_failed',
              '이벤트 그룹 규칙 삭제에 실패했습니다.'
            )
          )
        )
      }
    },
    [fetchRules, notify, t]
  )

  const totalCount = rules.length
  const warningCount = rules.filter(rule =>
    rule.conditions?.some(c => c.level === 'warning' && c.enabled)
  ).length
  const criticalCount = rules.filter(rule =>
    rule.conditions?.some(c => c.level === 'critical' && c.enabled)
  ).length

  const filteredRules = useMemo(() => {
    if (activeFilter === 'warning') {
      return rules.filter(rule =>
        rule.conditions?.some(c => c.level === 'warning' && c.enabled)
      )
    }
    if (activeFilter === 'critical') {
      return rules.filter(rule =>
        rule.conditions?.some(c => c.level === 'critical' && c.enabled)
      )
    }
    return rules
  }, [rules, activeFilter])

  const renderTopLeft = () => (
    <AlertSeverityFilter
      activeFilter={activeFilter}
      onChange={setActiveFilter}
      totalCount={totalCount}
      warningCount={warningCount}
      criticalCount={criticalCount}
    />
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

  const columns: ColumnInfo[] = useMemo(
    () => [
      {
        key: 'active',
        name: t('server_alert.active', '활성'),
        render: (value: boolean, row: AlertGroupRule) => (
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
        key: 'name',
        name: t('url_alert.event_name', '이벤트 이름'),
      },
      {
        key: 'urlTargetIds',
        name: 'Request / URL',
        className: 'url-alert-url-td',
        options: {
          thead: {className: 'url-alert-url-th'},
        },
        render: (_value: unknown, row: AlertGroupRule) => {
          const targets = (row.urlTargetIds ?? [])
            .map(id => targetsById[id])
            .filter(Boolean)
          return (
            <URLAlertUrlCell
              name={targets.map(target => target.name)}
              urls={targets.map(target => target.url)}
            />
          )
        },
      },
      {
        key: 'alertStatuses',
        name: t('url_alert.status', '상태'),
        options: {
          thead: {
            className: 'url-alert-status-th',
          },
        },
        render: (_value: unknown, row: AlertGroupRule) =>
          renderAlertStatusBadges(getRuleStatusBadges(row, unknownLabel)),
      },
      {
        key: 'trigger',
        name: t('server_alert.trigger', '조건 방식'),
        options: {
          thead: {className: 'url-alert-trigger-th'},
        },
        render: (_value: unknown, row: AlertGroupRule) => {
          if (!row.trigger) {
            return <span>-</span>
          }
          return renderAlertTriggerCell(row.trigger, row.values, t)
        },
      },
      {
        key: 'conditions',
        name: t('server_alert.rule', '규칙'),
        render: (value: AlertCondition[], row: AlertGroupRule) => {
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
                {row.measurement ? `${row.measurement} - ${row.field}` : '-'}
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
        render: (_value: unknown, row: AlertGroupRule) => (
          <div className="url-alert-row-actions">
            <Button
              icon={IconFont.Pencil}
              size={ComponentSize.ExtraSmall}
              shape={ButtonShape.Square}
              color={ComponentColor.Default}
              titleText={t('url_alert.edit', 'Edit')}
              onClick={e => {
                e.stopPropagation()
                if (row.id) {
                  navigateToAlertSetting(row.id)
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
      targetsById,
      unknownLabel,
      t,
      handleDelete,
      handleToggleActive,
      navigateToAlertSetting,
    ]
  )

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
            tableTitle={`${filteredRules.length} ${t(
              'url_alert.table_title',
              'URL Alerts'
            )}`}
            columns={columns}
            data={filteredRules}
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
