import {useEffect, useRef, useState} from 'react'
import {getHubbleEdgeFlows, hubbleEdgeFlowsWSUrl} from 'src/hubble/apis'
import {HubbleEdgeFlowsResponse, HubbleFlowRecord} from 'src/hubble/types'
import {formatHubbleError} from 'src/hubble/utils/errors'

interface UseEdgeFlowsResult {
  flows: HubbleFlowRecord[]
  loading: boolean
  connected: boolean
  error: string
}

const RECONNECT_INITIAL_MS = 1000
const RECONNECT_MAX_MS = 30000

// useEdgeFlows opens a WebSocket to the per-edge flow stream when an edge is
// selected. The server pushes the current ring buffer snapshot every push
// interval (~1-2s), so the table stays live without polling.
//
// REST is used as a one-shot initial fetch so the first render isn't blank
// while the socket is opening. After the WS connects, each push overwrites
// the local list.
export const useEdgeFlows = (
  cluster: string,
  src: string | null,
  dst: string | null,
  limit = 20,
  paused = false
): UseEdgeFlowsResult => {
  const [flows, setFlows] = useState<HubbleFlowRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(paused)

  pausedRef.current = paused

  useEffect(() => {
    if (!cluster || !src || !dst) {
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
      getHubbleEdgeFlows(cluster, src, dst, limit)
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
      const ws = new WebSocket(hubbleEdgeFlowsWSUrl(cluster, src, dst, limit))
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
      ws.onerror = () => {
        // onerror is followed by onclose; only the close drives reconnect.
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
  }, [cluster, src, dst, limit])

  return {flows, loading, connected, error}
}
