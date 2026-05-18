import React, {useState, useEffect, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {withRouter} from 'react-router'

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
import {ColumnInfo} from 'src/types'
import {
  AlertGroupRule,
  DEFAULT_RULE,
  AlertCondition,
} from 'src/alert_group/types'
import {getAlertGroupRules, deleteAlertGroupRule} from 'src/alert_group/apis'

import './ServerAlertManagementPage.scss'

function ServerAlertManagementPage({router, location}: any) {
  const {t} = useTranslation()
  const [data, setData] = useState<AlertGroupRule[]>([])
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'warning' | 'critical'
  >('all')

  // 데이터 가져오기
  const fetchData = async () => {
    try {
      const rules = await getAlertGroupRules()
      if (rules.length > 0) {
        setData(rules)
      } else {
        // API 결과가 없을 경우 더미 데이터 표시
      }
    } catch (error) {
      console.error('Failed to fetch alert group rules', error)
    }
    setData([
      {
        ...DEFAULT_RULE,
        id: '1',
        active: true,
        name: 'CPU Usage Alert',
        measurement: 'cpu',
        field: 'usage_idle',
        conditions: [
          {level: 'critical', value: '84', enabled: true},
          {level: 'warning', value: '44', enabled: true},
        ],
        occurrenceCount: 10,
        pauseSeconds: 0,
      },
      {
        ...DEFAULT_RULE,
        id: '2',
        active: true,
        name: 'CPU Usage Alert',
        measurement: 'cpu',
        field: 'usage_idle',
        conditions: [],
        occurrenceCount: 10,
        pauseSeconds: 0,
      },
      {
        ...DEFAULT_RULE,
        id: '3',
        active: true,
        name: 'Memory Usage Alert',
        measurement: 'mem',
        field: 'used_percent',
        conditions: [
          {level: 'critical', value: '84', enabled: true},
          {level: 'warning', value: '44', enabled: true},
        ],
        occurrenceCount: 10,
        pauseSeconds: 0,
      },
      {
        ...DEFAULT_RULE,
        id: '4',
        active: true,
        name: 'Disk Usage Alert',
        measurement: 'disk',
        field: 'used_percent',
        conditions: [
          {level: 'critical', value: '84', enabled: true},
          {level: 'warning', value: '44', enabled: true},
        ],
        occurrenceCount: 10,
        pauseSeconds: 0,
      },
    ])
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleToggleActive = (id: string) => {
    setData(prevData =>
      prevData.map(item =>
        item.id === id ? {...item, active: !item.active} : item
      )
    )
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAlertGroupRule(id)
      fetchData()
    } catch (error) {
      console.error('Failed to delete alert group rule', error)
    }
  }

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
    <div className="server-alert-filter-group">
      {/* Ocean Color */}
      <div
        className={`server-alert-filter-item server-alert-filter-item--ocean ${
          activeFilter === 'all' ? 'active' : ''
        }`}
        onClick={() => setActiveFilter('all')}
      >
        {t('server_alert.all', '전체')} ({totalCount})
      </div>
      {/* Warning Color (Yellow/Orange) */}
      <div
        className={`server-alert-filter-item server-alert-filter-item--warning ${
          activeFilter === 'warning' ? 'active' : ''
        }`}
        onClick={() => setActiveFilter('warning')}
      >
        {t('server_alert.warning', '경고')} ({warningCount})
      </div>
      {/* Danger Color (Red) */}
      <div
        className={`server-alert-filter-item server-alert-filter-item--critical ${
          activeFilter === 'critical' ? 'active' : ''
        }`}
        onClick={() => setActiveFilter('critical')}
      >
        {t('server_alert.critical', '위험')} ({criticalCount})
      </div>
    </div>
  )

  const renderTopRight = () => (
    <Button
      text={t('server_alert.add_event', '이벤트 추가')}
      icon={IconFont.Plus}
      size={ComponentSize.Small}
      color={ComponentColor.Primary}
      onClick={() => {
        if (location && location.pathname) {
          router.push(
            location.pathname.replace('/server-alert', '/alert-setup')
          )
        }
      }}
    />
  )

  const columns: ColumnInfo[] = useMemo(
    () => [
      {
        key: 'id',
        name: 'No',
      },
      {
        key: 'active',
        name: t('server_alert.active', '활성'),
        render: (value: boolean, row: AlertGroupRule) => (
          <SlideToggle
            active={value}
            size={ComponentSize.ExtraSmall}
            onChange={() => handleToggleActive(row.id!)}
          />
        ),
      },
      {
        key: 'name',
        name: t('server_alert.event_name', '이벤트 이름'),
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
                  ● Critical {row.triggerOperator} {critical.value}
                </span>
              )}
              {warning && (
                <span className="server-alert-rule-warning">
                  ● Warning {row.triggerOperator} {warning.value}
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
              icon={IconFont.Eye}
              size={ComponentSize.ExtraSmall}
              shape={ButtonShape.Square}
              color={ComponentColor.Default}
              onClick={() => {}}
            />
            <Button
              icon={IconFont.Pencil}
              size={ComponentSize.ExtraSmall}
              shape={ButtonShape.Square}
              color={ComponentColor.Default}
              onClick={() => {}}
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
    [t]
  )

  return (
    <Page>
      <Page.Header fullWidth={false}>
        <Page.Header.Left>
          <Page.Title
            title={t('server_alert.title', 'Server Alert Management')}
          />
        </Page.Header.Left>
        <Page.Header.Right />
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

export default withRouter(ServerAlertManagementPage)
