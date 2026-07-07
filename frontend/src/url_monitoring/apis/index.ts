import type {AxiosResponse} from 'axios'
import AJAX from 'src/utils/ajax'
import {
  AlertGroupRule,
  AlertTemplate,
  DEFAULT_RULE,
  UrlErrorConfig,
  urlErrorConfigToStatusFilters,
} from 'src/types'
import {
  getAlertGroupRule,
  getAlertGroupRules,
  getAlertTemplates,
} from 'src/alert_group/apis'
import {URLMonitoring, URLMonitoringTarget} from 'src/url_monitoring/types'

const BASE = '/cloudhub/v1/url-monitoring'
const TARGETS_BASE = '/cloudhub/v1/url-monitoring-targets'

export const getURLMonitoring = async (): Promise<URLMonitoring | null> => {
  try {
    const {data} = await AJAX({
      url: BASE,
      method: 'GET',
    })
    return (data as URLMonitoring) ?? null
  } catch (e) {
    // AJAX throws the response object directly (not a wrapped Error)
    if (e?.status === 404) return null
    throw e
  }
}

export const deleteURLMonitoring = async (id: string): Promise<void> => {
  await AJAX({
    url: `${BASE}/${id}`,
    method: 'DELETE',
  })
}

export interface URLMonitoringTargetUpsertRequest {
  name: string
  url: string
  interval: string
  responseTimeout?: string
  method?: string
  alertRuleId?: string
  elapsedTimeEnabled?: boolean
  elapsedTimeMs?: number | null
  elapsedTimeAlertMessage?: string
}

export const addURLMonitoringTarget = async (
  req: URLMonitoringTargetUpsertRequest
): Promise<URLMonitoring> => {
  const {data} = await AJAX({
    url: TARGETS_BASE,
    method: 'POST',
    data: req,
  })
  return data as URLMonitoring
}

export const patchURLMonitoringTarget = async (
  targetId: string,
  req: URLMonitoringTargetUpsertRequest
): Promise<URLMonitoring> => {
  const {data} = await AJAX({
    url: `${TARGETS_BASE}/${targetId}`,
    method: 'PATCH',
    data: req,
  })
  return data as URLMonitoring
}

export const deleteURLMonitoringTarget = async (
  targetId: string
): Promise<URLMonitoring> => {
  const {data} = await AJAX({
    url: `${TARGETS_BASE}/${targetId}`,
    method: 'DELETE',
  })
  return data as URLMonitoring
}

export interface URLMonitoringBulkAddResponse {
  succeeded: string[]
  failed: Array<{name: string; error: string}>
}

/** CloudHub JSON error shape from server.Error(). */
interface CloudhubJSONErrorBody {
  code?: number
  message?: string
}

export function getCloudhubAjaxErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as {data?: unknown}).data
    if (data && typeof data === 'object') {
      const msg = (data as CloudhubJSONErrorBody).message
      if (typeof msg === 'string' && msg.trim() !== '') {
        return msg
      }
    }
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as {message?: unknown}).message
    if (typeof msg === 'string' && msg.trim() !== '') {
      return msg
    }
  }
  if (err && typeof err === 'object' && 'statusText' in err) {
    const st = (err as {statusText?: unknown}).statusText
    if (typeof st === 'string' && st.trim() !== '') {
      return st
    }
  }
  return 'Request failed'
}

export const bulkAddURLMonitoringTargets = async (
  targets: URLMonitoringTargetUpsertRequest[]
): Promise<URLMonitoringBulkAddResponse> => {
  // Backend returns 207 (partial), 200 (all ok), or 400 when every row is invalid
  // (body still has succeeded/failed). Axios would otherwise reject 400 and hide the body.
  const res = (await AJAX({
    url: `${TARGETS_BASE}/bulk`,
    method: 'POST',
    data: {targets},
    validateStatus: status =>
      status === 200 || status === 207 || status === 400,
  })) as AxiosResponse<URLMonitoringBulkAddResponse | CloudhubJSONErrorBody>

  const {status, data} = res

  if (status === 400 && data && typeof data === 'object') {
    const bulk = data as URLMonitoringBulkAddResponse
    if (Array.isArray(bulk.succeeded) && Array.isArray(bulk.failed)) {
      return bulk
    }
    const errBody = data as CloudhubJSONErrorBody
    throw new Error(errBody.message ?? 'Bad request')
  }

  if (status !== 200 && status !== 207) {
    throw new Error('Unexpected bulk import response')
  }

  return data as URLMonitoringBulkAddResponse
}

export const applyURLMonitoring = async (id: string): Promise<void> => {
  await AJAX({
    url: `${BASE}/${id}/apply`,
    method: 'POST',
  })
}

export interface URLMonitoringStatus {
  fileExists: boolean
  collectorServer: string
  filePath: string
  reason?: string
}

export const getURLMonitoringStatus = async (
  id: string
): Promise<URLMonitoringStatus> => {
  const {data} = await AJAX({
    url: `${BASE}/${id}/status`,
    method: 'GET',
  })
  return data as URLMonitoringStatus
}

export const getURLMonitoringConfigContent = async (
  id: string
): Promise<string> => {
  const {data} = await AJAX({
    url: `${BASE}/${id}/config`,
    method: 'GET',
  })
  return (data as {config: string}).config
}

/** Default URL alert template id (builtin mock). */
export const DEFAULT_URL_ALERT_TEMPLATE_ID = 'url_monitoring_alert'

const URL_ALERT_BUILTIN_TEMPLATES: AlertTemplate[] = [
  {
    id: DEFAULT_URL_ALERT_TEMPLATE_ID,
    name: '상태 & 지연시간 알림',
    description:
      'URL 응답 코드 오류(4xx/5xx)가 발생하거나 응답 시간(지연)이 임계치를 초과할 경우 알림',
    category: 'url-monitoring',
    tags: ['url', 'http', 'status-code', 'availability'],
    taskType: 'stream',
    every: '30s',
    occurrenceType: 'consecutive',
    occurrenceCount: 2,
    occurrenceWindow: '5m',
    pauseSeconds: 0,
    notifyRecovery: true,
    message:
      '{{ index .Tags "server" }} URL 모니터링 알람 {{ .Level }} (상태 코드 또는 응답시간 지연)',
    measurement: 'http_response',
    field: 'response_time',
    targets: [
      {
        database: '',
        retentionPolicy: '',
        measurement: 'http_response',
        field: 'result_code',
        trigger: 'threshold',
        urlErrorConfig: {
          check4xx: true,
          check5xx: true,
          checkUnknown: true,
        },
        conditions: [
          {
            level: 'critical',
            value: 0,
            operator: 'greaterEqual',
            enabled: false,
          },
          {
            level: 'warning',
            value: 0,
            operator: 'greater',
            enabled: false,
          },
          {level: 'info', value: 0, operator: 'greater', enabled: false},
        ],
      },
      {
        database: '',
        retentionPolicy: '',
        measurement: 'http_response',
        field: 'response_time',
        trigger: 'threshold',
        conditions: [
          {level: 'critical', value: 5.0, operator: 'greater', enabled: true},
          {level: 'warning', value: 2.0, operator: 'greater', enabled: true},
          {level: 'info', value: 0, operator: 'greater', enabled: false},
        ],
      },
    ],
  },
]

export const getUrlAlertTemplates = async (): Promise<AlertTemplate[]> => {
  let customFromApi: AlertTemplate[] = []
  try {
    const all = await getAlertTemplates()
    customFromApi = all
      .filter(t => t.category === 'url-monitoring')
      .map(t => ({
        ...t,
        database: t.database?.trim() || '',
        retentionPolicy: t.retentionPolicy?.trim() || 'autogen',
      }))
  } catch {
    // degrade to builtin templates only
  }
  return [...URL_ALERT_BUILTIN_TEMPLATES, ...customFromApi]
}

interface MockUrlAlertRuleInput {
  id: string
  name: string
  active: boolean
  urlTargetIds: string[]
  status: UrlErrorConfig
  latency: {critical: number; warning: number}
  occurrenceCount?: number
  pauseSeconds?: number
}

// Builds a URL alert rule that mirrors the backend template form
// (targets[]: result_code + response_time), matching DEFAULT_URL_ALERT_TEMPLATE_ID.
const makeMockUrlAlertRule = (input: MockUrlAlertRuleInput): AlertGroupRule => {
  const {
    id,
    name,
    active,
    urlTargetIds,
    status,
    latency,
    occurrenceCount = 2,
    pauseSeconds = 0,
  } = input

  return {
    ...DEFAULT_RULE,
    id,
    name,
    active,
    templateId: DEFAULT_URL_ALERT_TEMPLATE_ID,
    taskType: 'stream',
    every: '30s',
    occurrenceType: 'consecutive',
    occurrenceCount,
    occurrenceWindow: '5m',
    pauseSeconds,
    notifyRecovery: true,
    trigger: 'threshold',
    measurement: 'http_response',
    field: 'response_time',
    message:
      '{{ index .Tags "server" }} URL 모니터링 알람 {{ .Level }} (상태 코드 또는 응답시간 지연)',
    urlTargetIds,
    urlErrorConfig: status,
    urlStatusFilters: urlErrorConfigToStatusFilters(status),
    conditions: [
      {
        level: 'critical',
        value: String(latency.critical),
        enabled: true,
        operator: 'greater',
      },
      {
        level: 'warning',
        value: String(latency.warning),
        enabled: true,
        operator: 'greater',
      },
      {level: 'info', value: '0', enabled: false, operator: 'greater'},
    ],
    targets: [
      {
        database: '',
        retentionPolicy: '',
        measurement: 'http_response',
        field: 'result_code',
        trigger: 'threshold',
        urlErrorConfig: status,
        conditions: [
          {
            level: 'critical',
            value: 0,
            operator: 'greaterEqual',
            enabled: false,
          },
          {level: 'warning', value: 0, operator: 'greater', enabled: false},
          {level: 'info', value: 0, operator: 'greater', enabled: false},
        ],
      },
      {
        database: '',
        retentionPolicy: '',
        measurement: 'http_response',
        field: 'response_time',
        trigger: 'threshold',
        conditions: [
          {
            level: 'critical',
            value: latency.critical,
            operator: 'greater',
            enabled: true,
          },
          {
            level: 'warning',
            value: latency.warning,
            operator: 'greater',
            enabled: true,
          },
          {level: 'info', value: 0, operator: 'greater', enabled: false},
        ],
      },
    ],
  }
}

const isUrlAlertRule = (rule: AlertGroupRule): boolean =>
  rule.measurement === 'http_response'

export interface UrlAlertListData {
  rules: AlertGroupRule[]
  targets: URLMonitoringTarget[]
}

// Loads the URL alert list (rules) together with the URL monitoring targets
// used to render the "Request / URL" column. Rules and targets are always
// sourced together — real API when URL alert rules exist, otherwise the mock
// bundle — so that rule.urlTargetIds always match the returned target ids.
export const getUrlAlertListData = async (): Promise<UrlAlertListData> => {
  const [rules, config] = await Promise.all([
    getAlertGroupRules({targetType: 'url'}), // 중요: 기본값 'server'가 아님
    getURLMonitoring().catch(() => null),
  ])
  console.log('rules', rules)
  return {
    rules: rules.filter(isUrlAlertRule),
    targets: config?.targets ?? [],
  }
}

export const getUrlAlertRules = async (): Promise<AlertGroupRule[]> => {
  const {rules} = await getUrlAlertListData()
  return rules
}

export const isMockUrlAlertRuleId = (id: string): boolean =>
  id.startsWith('mock-url-alert-')

export const getUrlAlertRule = async (id: string): Promise<AlertGroupRule> => {
  return getAlertGroupRule(id)
}
