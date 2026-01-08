import {manager} from 'src/worker/JobManager'

export interface ESProxyQuery {
  path: string
  method?: 'GET' | 'POST' | 'DELETE'
  params?: Record<string, any>
  body?: Record<string, any>
  uuid?: string
  host?: string
  signal?: AbortSignal
}

export interface ESProxyViaHubPayload {
  proxyUrl: string
  esReq: ESProxyQuery
  auth?: {username: string; password?: string}
}

export async function esProxy<T = any>(
  proxyUrl: string,
  esReq: ESProxyQuery
): Promise<T> {
  try {
    const result = await manager.esProxy(proxyUrl, esReq)
    return result as T
  } catch (err) {
    console.error('[esProxy] error:', err)
    throw err
  }
}
