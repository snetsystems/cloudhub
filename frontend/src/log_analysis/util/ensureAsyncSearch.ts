import {esProxy, ESProxyQuery} from 'src/utils/esQueryUrlGenerator'

export interface AsyncSearchResult<T = any> {
  id: string
  rawResponse: T
  isPartial: boolean
  isRunning: boolean
  total: number
  loaded: number
  isRestored: boolean
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
  }
}

export interface EnsureAsyncSearchOpts {
  pollMs?: number // Polling interval in ms (default 1000)
  waitTimeout?: string // wait_for_completion_timeout (default '5s')
  keepAlive?: string // keep_alive (default '60000ms')
  keepOnCompletion?: boolean // keep_on_completion (default true)
  signal?: AbortSignal // External AbortSignal (optional)
}

const DEFAULT_OPTS: Required<Omit<EnsureAsyncSearchOpts, 'signal'>> = {
  pollMs: 1000,
  waitTimeout: '5s',
  keepAlive: '60000ms',
  keepOnCompletion: true,
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

  // Try to retrieve previous search result by ID
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
      console.debug('Previous ID is invalid, starting new search')
    }
  }

  // Start a new async_search
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

  // Poll until the search is finished
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const {data} = await esProxy(proxyUrl, {
          path: `/_async_search/${res.id}`,
          method: 'GET',
          signal,
        })
        res = toAsyncSearchResult<T>(data)
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
