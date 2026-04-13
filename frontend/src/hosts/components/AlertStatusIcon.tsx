import React from 'react'
import {AlertLevel} from 'src/hosts/types/alertStatus'

interface Props {
  status: AlertLevel
  onStatusClick?: () => void
}

const STATUS_CONFIG: Record<
  AlertLevel,
  {iconClass: string; className: string; title: string}
> = {
  normal: {
    iconClass: 'checkmark1',
    className: 'alert-status-icon--normal',
    title: 'Normal',
  },
  warn: {
    iconClass: 'warning',
    className: 'alert-status-icon--warn',
    title: 'Warning',
  },
  danger: {
    iconClass: 'cancel',
    className: 'alert-status-icon--danger',
    title: 'Critical',
  },
  unknown: {
    iconClass: 'circle-thick',
    className: 'alert-status-icon--unknown',
    title: 'No Alert Data',
  },
}

const AlertStatusIcon = ({status, onStatusClick}: Props): JSX.Element => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown
  const isClickable = status !== 'normal' && !!onStatusClick

  return (
    <div
      className={`alert-status-icon ${config.className} ${isClickable ? 'clickable' : ''}`}
      onClick={isClickable ? onStatusClick : undefined}
      title={config.title}
      role={isClickable ? 'button' : undefined}
      style={{cursor: isClickable ? 'pointer' : 'default'}}
    >
      <span className={`icon ${config.iconClass}`} />
    </div>
  )
}

export default AlertStatusIcon

