import React, {useMemo, useRef} from 'react'
import {HubbleFlowRecord} from 'src/hubble/types'
import {
  PodOption,
  PodConnectionSummary,
  reconcilePodOrder,
  summarizePodConnections,
  summarizePods,
} from 'src/hubble/utils/podConnections'

interface Props {
  flows: HubbleFlowRecord[]
  namespace: string
  activePodKey: string | null
  focusedPeerKey: string | null
  onSelectPod: (pod: PodOption) => void
  onBack: () => void
  onFocusPeer: (pod: PodOption, peer: PodConnectionSummary) => void
}

const PodConnectionsPanel: React.FC<Props> = ({
  flows,
  namespace,
  activePodKey,
  focusedPeerKey,
  onSelectPod,
  onBack,
  onFocusPeer,
}) => {
  const pods = useMemo(() => summarizePods(flows, namespace), [flows, namespace])

  // Pin already-listed chips across the noisy rolling flow window; only
  // re-sort on a real event (namespace switch / denied-set change). Same
  // rationale as before — see podConnections.reconcilePodOrder.
  const orderRef = useRef<string[]>([])
  const deniedKeysRef = useRef<Set<string>>(new Set())
  const namespaceRef = useRef(namespace)

  const orderedPods = useMemo(() => {
    if (namespaceRef.current !== namespace) {
      orderRef.current = []
      deniedKeysRef.current = new Set()
      namespaceRef.current = namespace
    }
    orderRef.current = reconcilePodOrder(
      orderRef.current,
      deniedKeysRef.current,
      pods
    )
    deniedKeysRef.current = new Set(
      pods.filter(p => p.deniedFlows > 0).map(p => p.key)
    )
    const byKey = new Map(pods.map(p => [p.key, p]))
    return orderRef.current
      .map(key => byKey.get(key))
      .filter((p): p is PodOption => !!p)
  }, [pods, namespace])

  // Detail peers are computed unconditionally (empty key -> [] fast path) so
  // the hook order stays stable regardless of master/detail mode.
  const freshConnections = useMemo(
    () => sortPeers(summarizePodConnections(flows, activePodKey || '')),
    [flows, activePodKey]
  )

  // The bottom flow table shares this panel's `allFlows` stream. Focusing a peer
  // (or toggling one off) makes HubblePage narrow that stream to a single
  // pod<->peer pair, and useAllFlows keeps the narrowed data for one refetch
  // cycle (it doesn't reset flows to [] on a filter change) — so
  // `freshConnections` transiently shrinks to ~1 peer on both transitions. To
  // keep the peer list from collapsing, cache the fullest pod-scoped list seen
  // for the current pod and always render that. Reset only when the pod changes;
  // otherwise adopt fresh data only when it is at least as complete, never
  // letting a transient shrink overwrite the full list. (Same render-time
  // ref-update idiom used by orderRef above.)
  const listCacheRef = useRef<{key: string; conns: PodConnectionSummary[]}>({
    key: '',
    conns: [],
  })
  const podKeyNow = activePodKey || ''
  if (listCacheRef.current.key !== podKeyNow) {
    listCacheRef.current = {key: podKeyNow, conns: freshConnections}
  } else if (freshConnections.length >= listCacheRef.current.conns.length) {
    listCacheRef.current = {key: podKeyNow, conns: freshConnections}
  }
  const connections = listCacheRef.current.conns

  const selectedPod = activePodKey
    ? pods.find(p => p.key === activePodKey) || null
    : null

  if (selectedPod) {
    return (
      <div className="hubble-panel hubble-pod-connections-panel">
        <div className="hubble-panel-header">
          <button
            className="hubble-panel-title hubble-panel-back"
            onClick={onBack}
            title="Pod 목록으로 돌아가기"
          >
            <span className="hubble-panel-back-arrow">‹</span>
            Pods
          </button>
        </div>
        <div className="hubble-pod-detail-subtitle">
          <span title={selectedPod.key}>{selectedPod.pod}</span>
          <span>{selectedPod.workload || 'unknown workload'}</span>
          <span>{connections.length} peers</span>
        </div>
        {connections.length === 0 && (
          <div className="hubble-panel-empty">
            No peer connections in the current flow window.
          </div>
        )}
        {connections.length > 0 && (
          <ul className="hubble-pod-peer-list">
            {connections.map(peer => (
              <PeerRow
                key={peer.key}
                peer={peer}
                focused={peer.key === focusedPeerKey}
                onClick={() => onFocusPeer(selectedPod, peer)}
              />
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="hubble-panel hubble-pod-connections-panel">
      <div className="hubble-panel-header">
        <h4 className="hubble-panel-title">Pod connections</h4>
      </div>
      {orderedPods.length === 0 && (
        <div className="hubble-panel-empty">
          No pod-level flows observed in this namespace.
        </div>
      )}
      {orderedPods.length > 0 && (
        <>
          <div className="hubble-pod-list">
            {orderedPods.slice(0, 8).map(pod => (
              <button
                type="button"
                key={pod.key}
                className="hubble-pod-chip"
                onClick={() => onSelectPod(pod)}
                title={`${pod.key} connections`}
              >
                <span className="hubble-pod-chip-header">
                  <span className="hubble-pod-chip-name">{pod.pod}</span>
                  {pod.deniedFlows > 0 && (
                    <span className="hubble-pod-chip-badge">
                      Dropped {pod.deniedFlows}
                    </span>
                  )}
                </span>
                <span className="hubble-pod-chip-meta">
                  {pod.workload || 'unknown'} · {pod.flowCount}
                </span>
              </button>
            ))}
          </div>
          {orderedPods.length > 8 && (
            <div className="hubble-pod-more">
              +{orderedPods.length - 8} more pods
            </div>
          )}
          <div className="hubble-panel-empty">
            Select a pod to open inbound and outbound peers.
          </div>
        </>
      )}
    </div>
  )
}

// sortPeers surfaces dropped peers first (an operator's priority), then by
// flow volume. summarizePodConnections already returns flow-count order, so
// this is a stable dropped-first refinement.
const sortPeers = (
  connections: PodConnectionSummary[]
): PodConnectionSummary[] =>
  connections.slice().sort((a, b) => {
    const dropDelta = Number(hasDrop(b)) - Number(hasDrop(a))
    if (dropDelta !== 0) return dropDelta
    return b.flowCount - a.flowCount
  })

const hasDrop = (c: PodConnectionSummary): boolean =>
  (c.verdictCounts.DROPPED || 0) > 0

export const PeerRow: React.FC<{
  peer: PodConnectionSummary
  focused: boolean
  onClick: () => void
}> = ({peer, focused, onClick}) => {
  const label =
    peer.peerPod || peer.peerWorkload || peer.peerIp || peer.peerId || 'unknown'
  return (
    <li
      className={`hubble-pod-peer-row${hasDrop(peer) ? ' is-denied' : ''}${
        focused ? ' is-focused' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-pressed={focused}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      title="클릭해서 하단 Flow 테이블을 이 peer로 필터 (다시 클릭하면 해제)"
    >
      <span className="hubble-pod-peer-main">
        <span
          className={`hubble-pod-peer-dir is-${peer.direction}`}
          title={peer.direction}
        >
          {peer.direction === 'outbound' ? '⬆' : '⬇'}
        </span>
        <span className="hubble-pod-peer-name" title={label}>
          {label}
        </span>
        {peer.port ? (
          <span className="hubble-pod-peer-port">
            {peer.port} {peer.protocol}
          </span>
        ) : null}
      </span>
      <span className="hubble-pod-peer-stats">
        <VerdictChips counts={peer.verdictCounts} />
        <span className="hubble-pod-peer-flows">{peer.flowCount}</span>
      </span>
    </li>
  )
}

// VerdictChips reuses the shared hubble-verdict-* classes (forwarded green /
// dropped red) so a peer's drops read the same as everywhere else in the UI.
const VerdictChips: React.FC<{counts: Record<string, number>}> = ({counts}) => {
  const parts = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (parts.length === 0) {
    return <span className="hubble-pod-peer-verdicts">—</span>
  }
  return (
    <span className="hubble-pod-peer-verdicts">
      {parts.map(([verdict, count]) => (
        <span key={verdict} className={`hubble-verdict-${verdict.toLowerCase()}`}>
          {verdict.toLowerCase()} {count}
        </span>
      ))}
    </span>
  )
}

export default PodConnectionsPanel
