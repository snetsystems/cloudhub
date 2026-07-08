import type {AxiosResponse} from 'axios'
import AJAX from 'src/utils/ajax'
import {AlertGroupRule, AlertTemplate} from 'src/types'
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

export const getUrlAlertTemplates = async (): Promise<AlertTemplate[]> => {
  const templates = await getAlertTemplates({targetType: 'url'})
  const byId = new Map<string, AlertTemplate>()
  for (const template of templates) {
    byId.set(template.id, template)
  }
  return Array.from(byId.values())
}

export interface UrlAlertListData {
  rules: AlertGroupRule[]
  targets: URLMonitoringTarget[]
}

// Loads URL alert rules (targetType=url) together with URL monitoring targets
// for the "Request / URL" column.
export const getUrlAlertListData = async (): Promise<UrlAlertListData> => {
  const [rules, config] = await Promise.all([
    getAlertGroupRules({targetType: 'url'}),
    getURLMonitoring().catch(() => null),
  ])

  return {
    rules,
    targets: config?.targets ?? [],
  }
}

export const getUrlAlertRules = async (): Promise<AlertGroupRule[]> => {
  const {rules} = await getUrlAlertListData()
  return rules
}

export const getUrlAlertRule = async (id: string): Promise<AlertGroupRule> => {
  return getAlertGroupRule(id)
}
