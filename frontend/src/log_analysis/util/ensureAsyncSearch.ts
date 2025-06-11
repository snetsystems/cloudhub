import {esProxy, ESProxyQuery} from 'src/utils/esQueryUrlGenerator'
import _ from 'lodash'
import CryptoJS from 'crypto-js'

const cache = new Map<string, {id: string; data?: any}>()

export interface AsyncSearchResult<T = any> {
  id: string
  rawResponse: T
  isPartial: boolean
  isRunning: boolean
  total: number
  loaded: number
  isRestored: boolean
  isVailSearchId: boolean
}

export function toAsyncSearchResult<T = any>(raw: any): AsyncSearchResult<T> {
  return {
    id: raw.id,
    rawResponse: raw.response,
    isPartial: raw.is_partial,
    isRunning: raw.is_running,
    total: raw.response?._shards?.total ?? 0,
    loaded: raw.response?._shards?.successful ?? 0,
    isRestored: raw.is_restored ?? false,
    isVailSearchId: raw?.isVailSearchId ?? true,
  }
}

export interface EnsureAsyncSearchOpts {
  pollMs?: number // Polling interval in ms (default 1000)
  waitTimeout?: string // wait_for_completion_timeout (default '5s')
  keepAlive?: string // keep_alive (default '60000ms')
  keepOnCompletion?: boolean // keep_on_completion (default true)
  signal?: AbortSignal // External AbortSignal (optional)
  batched_reduce_size?: number
  ccs_minimize_roundtrips?: boolean
  wait_for_completion_timeout?: string
  keep_on_completion?: boolean
  ignore_unavailable?: boolean
  preference?: number
}

const DEFAULT_OPTS: Required<Omit<EnsureAsyncSearchOpts, 'signal'>> = {
  pollMs: 1000,
  waitTimeout: '5s',
  keepAlive: '60000ms',
  keepOnCompletion: true,
  batched_reduce_size: 64,
  ccs_minimize_roundtrips: true,
  wait_for_completion_timeout: '200ms',
  keep_on_completion: true,
  ignore_unavailable: true,
  preference: Date.now(),
}

export async function asyncSearch<T = any>(
  proxyUrl: string,
  esReq: ESProxyQuery,
  opts: EnsureAsyncSearchOpts = {}
): Promise<AsyncSearchResult<T>> {
  const key = stableHash(esReq)
  const c = cache.get(key)
  if (c?.data) return c.data as AsyncSearchResult<T>

  const res = await ensureAsyncSearch<T>(
    proxyUrl,
    {
      ...esReq,
      searchId: c?.id,
    },
    opts
  )
  if (!res.isRunning) cache.set(key, {id: res.id, data: res})
  else cache.set(key, {id: res.id})
  return res
}

export async function ensureAsyncSearch<T = any>(
  proxyUrl: string,
  esReq: ESProxyQuery & {searchId?: string},
  opts: EnsureAsyncSearchOpts = {}
): Promise<AsyncSearchResult<T>> {
  const {pollMs, waitTimeout, keepAlive, keepOnCompletion, signal} = {
    ...DEFAULT_OPTS,
    ...opts,
  }
  let isVailSearchId = true
  if (esReq.searchId) {
    try {
      const {data} = await esProxy(proxyUrl, {
        path: `/_async_search/${esReq.searchId}`,
        method: 'GET',
        signal,
      })
      const prev = toAsyncSearchResult<T>(data)
      if (!prev.isRunning) return prev
    } catch {
      isVailSearchId = false
    }
  }

  const {data: posted} = await esProxy(proxyUrl, {
    ...esReq,
    params: {
      keep_on_completion: keepOnCompletion,
      keep_alive: keepAlive,
      wait_for_completion_timeout: waitTimeout,
      ...(esReq.params ?? {}),
    },
    signal,
  })
  let res = toAsyncSearchResult<T>(posted)
  if (!res.isRunning) return res

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const {data} = await esProxy(proxyUrl, {
          path: `/_async_search/${res.id}`,
          method: 'GET',
          signal,
        })
        res = toAsyncSearchResult<T>({...data, isVailSearchId})
        if (!res.isRunning) {
          clearInterval(timer)
          resolve(res)
        }
      } catch (err) {
        clearInterval(timer)
        reject(err)
      }
    }, pollMs)

    signal?.addEventListener('abort', () => {
      clearInterval(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export const stableHash = (...args: unknown[]): string => {
  const json = JSON.stringify(args, sortReplacer)

  return CryptoJS.SHA1(json).toString(CryptoJS.enc.Hex)
}

function sortReplacer(_k: string, val: unknown) {
  if (
    val &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    Object.getPrototypeOf(val) === Object.prototype
  ) {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(val).sort()) {
      sorted[key] = (val as any)[key]
    }
    return sorted
  }
  return val
}
