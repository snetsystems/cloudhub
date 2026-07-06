import React from 'react'
import classnames from 'classnames'
import {useTranslation} from 'react-i18next'

export type AlertSeverityFilterValue = 'all' | 'warning' | 'critical'

interface Props {
  activeFilter: AlertSeverityFilterValue
  onChange: (filter: AlertSeverityFilterValue) => void
  totalCount: number
  warningCount: number
  criticalCount: number
  className?: string
}

const AlertSeverityFilter: React.FC<Props> = ({
  activeFilter,
  onChange,
  totalCount,
  warningCount,
  criticalCount,
  className,
}) => {
  const {t} = useTranslation()

  return (
    <div className={classnames('alert-severity-filter', className)}>
      <div
        className={classnames(
          'alert-severity-filter-item',
          'alert-severity-filter-item--ocean',
          {active: activeFilter === 'all'}
        )}
        onClick={() => onChange('all')}
      >
        {t('server_alert.all', '전체')} ({totalCount})
      </div>
      <div
        className={classnames(
          'alert-severity-filter-item',
          'alert-severity-filter-item--warning',
          {active: activeFilter === 'warning'}
        )}
        onClick={() => onChange('warning')}
      >
        {t('server_alert.warning', '경고')} ({warningCount})
      </div>
      <div
        className={classnames(
          'alert-severity-filter-item',
          'alert-severity-filter-item--critical',
          {active: activeFilter === 'critical'}
        )}
        onClick={() => onChange('critical')}
      >
        {t('server_alert.critical', '위험')} ({criticalCount})
      </div>
    </div>
  )
}

export default AlertSeverityFilter
