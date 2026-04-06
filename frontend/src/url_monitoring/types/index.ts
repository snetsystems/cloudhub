export interface URLMonitoringTarget {
  id?: string
  name: string
  url: string
  interval: string
  responseTimeout?: string
  method?: string
  alertRuleId?: string
}

export interface URLMonitoring {
  id: string
  orgId: string
  targets: URLMonitoringTarget[]
}

export interface URLMonitoringRequest {
  targets: URLMonitoringTarget[]
}

export const DEFAULT_URL_MONITORING: URLMonitoringRequest = {
  targets: [],
}

export const INTERVAL_OPTIONS = ['1m', '2m', '5m', '10m']
export const METHOD_OPTIONS = ['GET', 'POST', 'HEAD']
export const DEFAULT_RESPONSE_TIMEOUT = '5s'
export const DEFAULT_METHOD = 'GET'
