export type AlertLevel = 'normal' | 'warn' | 'danger' | 'unknown'

export interface AlertTimePoint {
  time: string // ISO timestamp
  level: AlertLevel
  alertName: string
  message?: string
  value?: number
}

export interface HostAlertStatus {
  currentLevel: AlertLevel
  history: AlertTimePoint[]
}

export type AlertStatusMap = Record<string, HostAlertStatus>
