import React from 'react'
import {AlertLevel, AlertStatusMap} from 'src/hosts/types/alertStatus'

interface Props {
  alertStatusMap: AlertStatusMap
  tableData?: any[]
  isAlertsEnabled?: boolean
}

const LEVEL_ORDER: AlertLevel[] = ['normal', 'warn', 'danger', 'unknown']

const SUMMARY_CONFIG: Record<
  AlertLevel,
  {iconClass: string; className: string; title: string}
> = {
  normal: {
    iconClass: 'checkmark1',
    className: 'alert-summary-badge--normal',
    title: 'Normal',
  },
  warn: {
    iconClass: 'warning',
    className: 'alert-summary-badge--warn',
    title: 'Warning',
  },
  danger: {
    iconClass: 'cancel',
    className: 'alert-summary-badge--danger',
    title: 'Critical',
  },
  unknown: {
    iconClass: 'circle-thick',
    className: 'alert-summary-badge--unknown',
    title: 'Unknown',
  },
}

const AlertStatusSummary = ({
  alertStatusMap,
  tableData = [],
  isAlertsEnabled = true,
}: Props): JSX.Element => {
  const counts: Record<AlertLevel, number> = {
    normal: 0,
    warn: 0,
    danger: 0,
    unknown: 0,
  }

  tableData.forEach(row => {
    const host = row.host as string
    if (!host) return
    const level = alertStatusMap[host]?.currentLevel ?? 'normal'
    counts[level] = (counts[level] ?? 0) + 1
  })

  return (
    <div className={`alert-status-summary ${!isAlertsEnabled ? 'disabled' : ''}`} title={!isAlertsEnabled ? "Alarms not configured. Please add Kapacitor scripts." : ""}>
      {LEVEL_ORDER.map(level => {
        const config = SUMMARY_CONFIG[level]
        const finalClassName = isAlertsEnabled ? config.className : 'alert-summary-badge--disabled'
        return (
          <span
            key={level}
            className={`alert-summary-badge ${finalClassName}`}
            title={isAlertsEnabled ? config.title : "Unmonitored"}
          >
            <span className={`icon ${config.iconClass} alert-summary-icon`} />
            <span className="alert-summary-title">{config.title}</span>
            <span className="alert-summary-count">{isAlertsEnabled ? counts[level] : '-'}</span>
          </span>
        )
      })}
    </div>
  )
}

export default AlertStatusSummary
