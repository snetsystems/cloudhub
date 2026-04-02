import AJAX from 'src/utils/ajax'
import {URLMonitoring} from '../types'

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
