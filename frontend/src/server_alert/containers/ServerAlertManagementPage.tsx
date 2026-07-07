import React, {useState, useEffect, useMemo, useCallback} from 'react'
import {useTranslation} from 'react-i18next'
import {withRouter} from 'react-router'
import {connect} from 'react-redux'

import TableComponent from 'src/device_management/components/TableComponent'
import {
  Button,
  ComponentColor,
  ComponentSize,
  IconFont,
  SlideToggle,
  ButtonShape,
  Page,
} from 'src/reusable_ui'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import AlertSeverityFilter, {
  AlertSeverityFilterValue,
} from 'src/shared/components/AlertSeverityFilter'
import {
  ColumnInfo,
  AlertGroupRule,
  AlertCondition,
  OPERATOR_SYMBOLS,
} from 'src/types'
import {
  getAlertGroupRules,
  deleteAlertGroupRuleAndFetch,
  updateAlertGroupRule,
} from 'src/alert_group/apis'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifySuccess, notifyError} from 'src/shared/copy/notifications'

const getOperatorSymbol = (op: string): string => {
  if (!op) {
    return ''
  }
  return OPERATOR_SYMBOLS[op] || op
}

function ServerAlertManagementPage({router, location, notify}: any) {
  const {t} = useTranslation()
  const [data, setData] = useState<AlertGroupRule[]>([])
  const [activeFilter, setActiveFilter] = useState<AlertSeverityFilterValue>(
    'all'
  )

  // 데이터 가져오기
  const fetchData = async () => {
    try {
      const rules = await getAlertGroupRules()
      if (rules.length > 0) {
        setData(rules)
      }
    } catch (error) {
      console.error('Failed to fetch alert group rules', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleToggleActive = useCallback(
    async (rule: AlertGroupRule) => {
      if (!rule || !rule.id) return

      try {
        const updatedRule = await updateAlertGroupRule(rule.id, {
          ...rule,
          active: !rule.active,
        })
        setData(prevData =>
          prevData.map(item => (item.id === rule.id ? updatedRule : item))
        )
      } catch (error) {
        console.error('Failed to update alert group rule', error)
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
    async (id: string) => {
      try {
        const updatedRules = await deleteAlertGroupRuleAndFetch(id)
        setData(updatedRules)
        notify(
          notifySuccess(
            t('server_alert.delete_success', '이벤트 그룹 규칙을 삭제했습니다.')
          )
        )
      } catch (error) {
        console.error('Failed to delete alert group rule', error)
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
    [notify, t]
  )

  // 카운트 계산 (데이터 기반)
  const totalCount = data.length
  const warningCount = data.filter(rule =>
    rule.conditions?.some(c => c.level === 'warning' && c.enabled)
  ).length
  const criticalCount = data.filter(rule =>
    rule.conditions?.some(c => c.level === 'critical' && c.enabled)
  ).length

  const filteredData = useMemo(() => {
    if (activeFilter === 'warning') {
      return data.filter(rule =>
        rule.conditions?.some(c => c.level === 'warning' && c.enabled)
      )
    }
    if (activeFilter === 'critical') {
      return data.filter(rule =>
        rule.conditions?.some(c => c.level === 'critical' && c.enabled)
      )
    }
    return data
  }, [data, activeFilter])

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
      text={t('server_alert.add_event', '이벤트 추가')}
      icon={IconFont.BellAdd}
      size={ComponentSize.Small}
      color={ComponentColor.Primary}
      onClick={() => {
        if (location && location.pathname) {
          router.push({
            pathname: location.pathname.replace(
              '/server-alert',
              '/alert-setup'
            ),
            state: {returnTo: location.pathname},
          })
        }
      }}
    />
  )

  const columns: ColumnInfo[] = useMemo(
    () => [
      {
        key: 'active',
        name: t('server_alert.active', '활성'),
        render: (value: boolean, row: AlertGroupRule) => (
          <SlideToggle
            active={value}
            size={ComponentSize.ExtraSmall}
            onChange={() => handleToggleActive(row)}
          />
        ),
      },
      {
        key: 'name',
        name: t('server_alert.event_name', '이벤트 이름'),
      },
      {
        key: 'trigger',
        name: t('server_alert.trigger', '조건 방식'),
        render: (_value: any, row: AlertGroupRule) => {
          const trigger = row.trigger || 'threshold'
          const values = row.values

          if (trigger === 'threshold') {
            return (
              <div className="server-alert-trigger-cell">
                <span className="server-alert-trigger-main">
                  {t('alert_group_rule.threshold', 'Threshold')}
                </span>
              </div>
            )
          }

          if (trigger === 'relative') {
            const shift = values?.shift || ''
            const changeVal = values?.change || 'change'
            const changeText =
              changeVal === '% change'
                ? t('server_alert.pct_change', '변화율')
                : t('server_alert.amt_change', '변화량')
            const optionText = shift
              ? `${shift} ${changeText}`
              : `${changeText}`

            return (
              <div className="server-alert-trigger-cell">
                <span className="server-alert-trigger-main">
                  {t('alert_group_rule.relative', 'Relative')}
                </span>
                <span className="server-alert-trigger-sub">{optionText}</span>
              </div>
            )
          }

          if (trigger === 'deadman') {
            const period = values?.period || ''
            return (
              <div className="server-alert-trigger-cell">
                <span className="server-alert-trigger-main">
                  {t('alert_group_rule.deadman', 'Deadman')}
                </span>
                {period && (
                  <span className="server-alert-trigger-sub">{period}</span>
                )}
              </div>
            )
          }

          return <span>-</span>
        },
      },
      {
        key: 'conditions',
        name: t('server_alert.rule', '규칙'),
        render: (value: AlertCondition[], row: AlertGroupRule) => {
          if (!value || value.length === 0) {
            return (
              <div className="server-alert-rule-container">
                <span>-</span>
              </div>
            )
          }

          const critical = value.find(c => c.level === 'critical' && c.enabled)
          const warning = value.find(c => c.level === 'warning' && c.enabled)

          return (
            <div className="server-alert-rule-container">
              <span>
                {row.measurement ? `${row.measurement} - ${row.field}` : '-'}
              </span>
              {critical && (
                <span className="server-alert-rule-critical">
                  ● Critical {getOperatorSymbol(critical.operator)}{' '}
                  {critical.value}
                </span>
              )}
              {warning && (
                <span className="server-alert-rule-warning">
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
        render: (_value: any, row: AlertGroupRule) => (
          <div className="server-alert-settings-container">
            <Button
              icon={IconFont.Pencil}
              size={ComponentSize.ExtraSmall}
              shape={ButtonShape.Square}
              color={ComponentColor.Default}
              onClick={() => {
                if (location && location.pathname) {
                  router.push({
                    pathname: location.pathname.replace(
                      '/server-alert',
                      '/alert-setup'
                    ),
                    query: {id: row.id},
                    state: {returnTo: location.pathname},
                  })
                }
              }}
            />
            <ConfirmButton
              icon={IconFont.Trash}
              size="btn-xs"
              square={true}
              type="btn-danger"
              confirmText={t('server_alert.delete', '삭제')}
              confirmAction={() => handleDelete(row.id!)}
            />
          </div>
        ),
      },
    ],
    [t, handleToggleActive, handleDelete]
  )

  return (
    <Page>
      <Page.Header fullWidth={false}>
        <Page.Header.Left>
          <Page.Title
            title={t('server_alert.title', 'Server Alert Management')}
          />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents>
        <div className="server-alert-page-content">
          <TableComponent
            tableTitle={`${filteredData.length} ${t(
              'server_alert.table_title',
              'Server Alerts'
            )}`}
            columns={columns}
            data={filteredData}
            topLeftRender={renderTopLeft()}
            toprightRender={renderTopRight()}
            isSearchDisplay={true}
            options={{tbodyRow: {className: 'server-alert-table-row'}}}
          />
        </div>
      </Page.Contents>
    </Page>
  )
}

const mapDispatchToProps = {
  notify: notifyAction,
}

export default connect(
  null,
  mapDispatchToProps
)(withRouter(ServerAlertManagementPage))
