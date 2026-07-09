import {useEffect, useRef, useState} from 'react'
import {getHubbleAllFlows, hubbleAllFlowsWSUrl} from 'src/hubble/apis'
import {
  HubbleEdgeFlowsResponse,
  HubbleFlowFilters,
  HubbleFlowRecord,
} from 'src/hubble/types'
import {formatHubbleError} from 'src/hubble/utils/errors'

interface UseAllFlowsResult {
  flows: HubbleFlowRecord[]
  connected: boolean
  loading: boolean
  error: string
}

const RECONNECT_INITIAL_MS = 1000
const RECONNECT_MAX_MS = 30000

// useAllFlows streams the bottom flow table. In overview it is cluster-wide;
// in drilldown it is filtered to flows touching the selected namespace.
export const useAllFlows = (
  cluster: string,
  limit = 200,
  enabled = true,
  namespace?: string | null,
  filters?: HubbleFlowFilters,
  paused = false
): UseAllFlowsResult => {
  const [flows, setFlows] = useState<HubbleFlowRecord[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(paused)

  pausedRef.current = paused

  useEffect(() => {
    if (!cluster || !enabled) {
      setFlows([])
      setConnected(false)
      setError('')
      return
    }

    let cancelled = false
    let attempt = 0
    setLoading(true)
    setError('')

    const initialFetch = () => {
      getHubbleAllFlows(cluster, limit, namespace, filters)
        .then(r => {
          if (cancelled) return
          setFlows(r.flows || [])
          setLoading(false)
        })
        .catch(e => {
          if (cancelled) return
          setError(formatHubbleError(e))
          setLoading(false)
        })
    }

    const connect = () => {
      if (cancelled) return
      const ws = new WebSocket(
        hubbleAllFlowsWSUrl(cluster, limit, namespace, filters)
      )
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) return
        attempt = 0
        setConnected(true)
        setError('')
      }
      ws.onmessage = ev => {
        if (cancelled || pausedRef.current) return
        try {
          const parsed = JSON.parse(ev.data) as HubbleEdgeFlowsResponse
          setFlows(parsed.flows || [])
          setLoading(false)
        } catch (e) {
          setError(`bad flows payload: ${(e as Error).message}`)
        }
      }
      ws.onclose = () => {
        if (cancelled) return
        setConnected(false)
        const delay = Math.min(
          RECONNECT_INITIAL_MS * Math.pow(2, attempt),
          RECONNECT_MAX_MS
        )
        attempt += 1
        reconnectTimer.current = globalThis.setTimeout(connect, delay)
      }
    }

    initialFetch()
    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current !== null) {
        globalThis.clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [cluster, limit, enabled, namespace, filters])

  return {flows, connected, loading, error}
}
