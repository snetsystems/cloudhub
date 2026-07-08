import {useEffect, useRef, useState} from 'react'
import {
  getHubbleDrilldownSnapshot,
  getHubbleOverviewSnapshot,
  hubbleDrilldownWSUrl,
  hubbleOverviewWSUrl,
} from 'src/hubble/apis'
import {HubbleSnapshot} from 'src/hubble/types'
import {formatHubbleError} from 'src/hubble/utils/errors'

interface UseHubbleSnapshotResult {
  snapshot: HubbleSnapshot | null
  connected: boolean
  loading: boolean
  error: string
}

const RECONNECT_INITIAL_MS = 1000
const RECONNECT_MAX_MS = 30000

// useHubbleSnapshot fetches the initial REST snapshot for a cluster (and an
// optional drilldown namespace), then opens a WebSocket that overwrites the
// snapshot whenever the server pushes one. Reconnects with exponential
// backoff on close; gives up only when the consumer unmounts or arguments
// change.
//
// Pass `namespace=null` for overview mode; a non-empty string switches to the
// per-namespace drilldown stream.
export const useHubbleSnapshot = (
  cluster: string,
  namespace: string | null,
  paused = false
): UseHubbleSnapshotResult => {
  const [snapshot, setSnapshot] = useState<HubbleSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const pausedRef = useRef(paused)
  const frozenSnapshotRef = useRef<HubbleSnapshot | null>(null)
  const wasPausedRef = useRef(paused)

  pausedRef.current = paused
  if (paused && !wasPausedRef.current) {
    frozenSnapshotRef.current = snapshot
  }
  if (!paused) {
    frozenSnapshotRef.current = null
  }
  wasPausedRef.current = paused

  const displaySnapshot =
    paused && frozenSnapshotRef.current ? frozenSnapshotRef.current : snapshot

  useEffect(() => {
    if (!cluster) {
      setSnapshot(null)
      setConnected(false)
      setLoading(false)
      return
    }

    let cancelled = false
    let attempt = 0
    setLoading(true)
    setSnapshot(null)
    setError('')

    const fetchInitial = async () => {
      try {
        const s = namespace
          ? await getHubbleDrilldownSnapshot(cluster, namespace)
          : await getHubbleOverviewSnapshot(cluster)
        if (!cancelled) {
          setSnapshot(s)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatHubbleError(e))
          setLoading(false)
        }
      }
    }

    const connect = () => {
      if (cancelled) return
      const url = namespace
        ? hubbleDrilldownWSUrl(cluster, namespace)
        : hubbleOverviewWSUrl(cluster)
      const ws = new WebSocket(url)
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
          const parsed = JSON.parse(ev.data) as HubbleSnapshot
          setSnapshot(parsed)
          setLoading(false)
        } catch (e) {
          setError(`bad snapshot: ${(e as Error).message}`)
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
        reconnectTimer.current = window.setTimeout(connect, delay)
      }
    }

    fetchInitial()
    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [cluster, namespace])

  return {snapshot: displaySnapshot, connected, loading, error}
}
