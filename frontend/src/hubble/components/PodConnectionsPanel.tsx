import React, {useEffect, useMemo, useRef, useState} from 'react'
import {
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
} from 'src/reusable_ui'
import {HubbleFlowRecord} from 'src/hubble/types'
import {buildEdgePath} from 'src/hubble/utils/edgeAnchors'
import {edgeVerdictColor} from 'src/hubble/utils/edgeVerdict'
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
}

const PodConnectionsPanel: React.FC<Props> = ({flows, namespace}) => {
  const pods = useMemo(() => summarizePods(flows, namespace), [
    flows,
    namespace,
  ])

  // The pod list order is deliberately NOT recomputed straight from `pods`
  // on every render: the underlying flow feed is a rolling window (last 200
  // events), so raw flow counts wobble on every push and would otherwise
  // reorder the chips constantly. reconcilePodOrder pins existing chips in
  // place and only re-sorts on a real event (namespace switch, or a pod's
  // denied-flow status changing) — see podConnections.ts.
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

  const [selectedPodKey, setSelectedPodKey] = useState<string>('')

  useEffect(() => {
    if (!selectedPodKey) return
    if (!pods.some(p => p.key === selectedPodKey)) {
      setSelectedPodKey('')
    }
  }, [pods, selectedPodKey])

  const selectedPod = pods.find(p => p.key === selectedPodKey) || null
  const connections = useMemo(
    () => summarizePodConnections(flows, selectedPodKey),
    [flows, selectedPodKey]
  )

  return (
    <div className="hubble-panel hubble-pod-connections-panel">
      <div className="hubble-panel-header">
        <h4 className="hubble-panel-title">Pod connections</h4>
      </div>
      {pods.length === 0 && (
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
                className={`hubble-pod-chip ${
                  pod.key === selectedPodKey ? 'is-selected' : ''
                }`}
                onClick={() => setSelectedPodKey(pod.key)}
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
        </>
      )}
      {pods.length > 0 && (
        <div className="hubble-panel-empty">
          Select a pod to open inbound and outbound peers.
        </div>
      )}
      <PodConnectionsModal
        pod={selectedPod}
        connections={connections}
        onClose={() => setSelectedPodKey('')}
      />
    </div>
  )
}

const PodConnectionsModal: React.FC<{
  pod: PodOption | null
  connections: PodConnectionSummary[]
  onClose: () => void
}> = ({pod, connections, onClose}) => {
  if (!pod) return null

  return (
    <OverlayTechnology visible={!!pod}>
      <OverlayContainer maxWidth={1120}>
        <OverlayHeading title="Pod Connections">
          <button
            type="button"
            className="hubble-overlay-close"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </OverlayHeading>
        <OverlayBody>
          <div className="hubble-pod-modal-subtitle">
            <span title={pod.key}>{pod.pod}</span>
            <span>{pod.namespace}</span>
            <span>{pod.workload || 'unknown workload'}</span>
            <span>{connections.length} peers</span>
          </div>
          <PodConnectionsGraph pod={pod} connections={connections} />
          <div className="hubble-pod-modal-body">
            {connections.length === 0 && (
              <div className="hubble-panel-empty">
                No peer connections in the current flow window.
              </div>
            )}
            {connections.length > 0 && (
              <table className="hubble-pod-modal-table">
                <thead>
                  <tr>
                    <th>Direction</th>
                    <th>Peer Pod</th>
                    <th>Workload</th>
                    <th>Namespace</th>
                    <th>Peer IP</th>
                    <th>Port</th>
                    <th>Verdict</th>
                    <th>Drop reason</th>
                    <th>Last seen</th>
                    <th className="text-right">Flows</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map(connection => (
                    <ConnectionRow
                      key={connection.key}
                      connection={connection}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

const PodConnectionsGraph: React.FC<{
  pod: PodOption
  connections: PodConnectionSummary[]
}> = ({pod, connections}) => {
  const graphConnections = useMemo(
    () => summarizeGraphConnections(connections),
    [connections]
  )
  const inbound = graphConnections.filter(c => c.direction === 'inbound')
  const outbound = graphConnections.filter(c => c.direction === 'outbound')

  return (
    <div className="hubble-pod-graph">
      <svg viewBox="0 0 900 280" role="img" aria-label="Pod connection graph">
        {inbound.map((connection, index) => (
          <GraphConnection
            key={`in-${connection.key}`}
            connection={connection}
            index={index}
            total={inbound.length}
            selectedLabel={pod.pod}
          />
        ))}
        {outbound.map((connection, index) => (
          <GraphConnection
            key={`out-${connection.key}`}
            connection={connection}
            index={index}
            total={outbound.length}
            selectedLabel={pod.pod}
          />
        ))}
        <GraphNode
          x={450}
          y={140}
          label={pod.pod}
          meta={pod.workload || pod.namespace}
          kind="workload"
          selected
        />
      </svg>
      {graphConnections.length < connections.length && (
        <div className="hubble-pod-graph-note">
          Graph highlights dropped and pod/workload peers. Full raw peer list is
          in the table below.
        </div>
      )}
    </div>
  )
}

const GraphConnection: React.FC<{
  connection: PodConnectionSummary
  index: number
  total: number
  selectedLabel: string
}> = ({connection, index, total, selectedLabel}) => {
  const inbound = connection.direction === 'inbound'
  const peerX = inbound ? 170 : 730
  const peerY = graphY(index, total)
  const dropped = (connection.verdictCounts.DROPPED || 0) > 0
  // Reuse the main ServiceMap edge palette (forwarded green / denied red) so
  // the modal graph reads as the same product surface, not a separate one.
  const color = edgeVerdictColor(dropped ? 'denied' : 'forwarded')
  // Anchor on the node edges (peer side ↔ pod side), like ServiceMap does,
  // and draw a curved bezier instead of a straight line. The pod node spans
  // x=374..526 around the centre at (450, 140).
  const from = inbound ? {x: peerX + 76, y: peerY} : {x: 526, y: 140}
  const to = inbound ? {x: 374, y: 140} : {x: peerX - 76, y: peerY}
  const peerLabel =
    connection.peerPod ||
    connection.peerWorkload ||
    connection.peerIp ||
    connection.peerId ||
    'unknown'

  return (
    <g>
      <path
        d={buildEdgePath(from, to)}
        fill="none"
        stroke={color}
        strokeWidth={edgeWidth(connection.flowCount)}
        strokeDasharray={dropped ? '6 4' : undefined}
        opacity={0.75}
      />
      <GraphNode
        x={peerX}
        y={peerY}
        label={peerLabel}
        meta={connection.peerWorkload || connection.peerNamespace || 'external'}
        kind={graphNodeKind(connection)}
        grouped={connection.key.includes('|group:')}
      />
      <title>
        {inbound
          ? `${peerLabel} -> ${selectedLabel}`
          : `${selectedLabel} -> ${peerLabel}`}
      </title>
    </g>
  )
}

// GRAPH_NODE_ACCENT_COLOR mirrors the left accent bar HubbleNodeCard uses to
// distinguish node kind (.hubble-node-card--workload / --external) — the
// graph draws its own SVG "cards" instead of reusing that DOM component, so
// the color has to be replicated here to keep the two visually consistent.
const GRAPH_NODE_ACCENT_COLOR: Record<'workload' | 'external', string> = {
  workload: '#7a65f2',
  external: '#8e91a1',
}

// isRedundantMeta mirrors HubbleNodeCard's nodeSubtitle() rule: don't show a
// second line that just repeats the first. Pod names are usually
// "<workload>-<hash/ordinal>", so the workload meta line is redundant with
// the pod label far more often than it's distinct — check the prefix, not
// just exact equality.
export const isRedundantMeta = (label: string, meta: string): boolean =>
  !meta || meta === label || label.startsWith(`${meta}-`)

const GraphNode: React.FC<{
  x: number
  y: number
  label: string
  meta: string
  kind: 'workload' | 'external'
  selected?: boolean
  grouped?: boolean
}> = ({x, y, label, meta, kind, selected, grouped}) => {
  const showMeta = !isRedundantMeta(label, meta)
  return (
    <g transform={`translate(${x - 76}, ${y - 24})`}>
      <rect
        width="152"
        height="48"
        rx="5"
        className={`hubble-pod-graph-node ${selected ? 'is-selected' : ''} ${
          grouped ? 'is-grouped' : ''
        }`}
      />
      <rect
        className="hubble-pod-graph-node-accent"
        x="0"
        y="4"
        width="3"
        height="40"
        rx="1.5"
        fill={GRAPH_NODE_ACCENT_COLOR[kind]}
      />
      {/* HTML label inside foreignObject so overflow is trimmed by actual
          width with a CSS ellipsis — same mechanism the ServiceMap node
          cards use — instead of a font-dependent character cap. */}
      <foreignObject x="8" y="4" width="136" height="40">
        <div className="hubble-pod-graph-node-text">
          <div className="hubble-pod-graph-node-label" title={label}>
            {label}
          </div>
          {showMeta && <div className="hubble-pod-graph-node-meta">{meta}</div>}
        </div>
      </foreignObject>
      <title>{label}</title>
    </g>
  )
}

export const graphNodeKind = (
  connection: PodConnectionSummary
): 'workload' | 'external' =>
  !connection.key.includes('|group:') && isPodPeer(connection)
    ? 'workload'
    : 'external'

const summarizeGraphConnections = (
  connections: PodConnectionSummary[]
): PodConnectionSummary[] =>
  (['inbound', 'outbound'] as const).flatMap(direction => {
    const byDirection = connections.filter(c => c.direction === direction)
    const important = byDirection
      .filter(c => isDropped(c) || (isPodPeer(c) && !isDnsPeer(c)))
      .sort(compareGraphConnection)
      .slice(0, 4)
    const used = new Set(important.map(c => c.key))
    const remaining = byDirection.filter(c => !used.has(c.key))
    const grouped = [
      aggregateGraphGroup(
        direction,
        remaining.filter(isDnsPeer),
        'DNS',
        'port 53'
      ),
      aggregateGraphGroup(
        direction,
        remaining.filter(c => !isDnsPeer(c) && !isPodPeer(c)),
        'External / IP',
        'non-pod peers'
      ),
    ].filter(Boolean) as PodConnectionSummary[]
    return [...important, ...grouped].sort(compareGraphConnection).slice(0, 4)
  })

const aggregateGraphGroup = (
  direction: PodConnectionSummary['direction'],
  connections: PodConnectionSummary[],
  label: string,
  meta: string
): PodConnectionSummary | null => {
  if (connections.length === 0) return null
  return connections.reduce<PodConnectionSummary>(
    (acc, connection) => ({
      ...acc,
      flowCount: acc.flowCount + connection.flowCount,
      lastSeen: newerTime(acc.lastSeen, connection.lastSeen),
      verdictCounts: mergeCounts(acc.verdictCounts, connection.verdictCounts),
      dropReasons: mergeCounts(acc.dropReasons, connection.dropReasons),
    }),
    {
      key: `${direction}|group:${label}`,
      direction,
      peerNamespace: meta,
      peerPod: label,
      peerWorkload: '',
      peerIp: '',
      peerId: '',
      protocol: '',
      flowCount: 0,
      lastSeen: '',
      verdictCounts: {},
      dropReasons: {},
    }
  )
}

const mergeCounts = (
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> => {
  const out = {...a}
  Object.entries(b).forEach(([key, value]) => {
    out[key] = (out[key] || 0) + value
  })
  return out
}

const compareGraphConnection = (
  a: PodConnectionSummary,
  b: PodConnectionSummary
): number => {
  const droppedDelta = Number(isDropped(b)) - Number(isDropped(a))
  if (droppedDelta !== 0) return droppedDelta
  const podDelta = Number(isPodPeer(b)) - Number(isPodPeer(a))
  if (podDelta !== 0) return podDelta
  return b.flowCount - a.flowCount
}

const isDropped = (connection: PodConnectionSummary): boolean =>
  (connection.verdictCounts.DROPPED || 0) > 0

const isPodPeer = (connection: PodConnectionSummary): boolean =>
  !!(connection.peerPod || connection.peerWorkload)

const isDnsPeer = (connection: PodConnectionSummary): boolean =>
  connection.port === 53 ||
  connection.peerWorkload === 'coredns' ||
  connection.peerPod.startsWith('coredns-')

const ConnectionRow: React.FC<{connection: PodConnectionSummary}> = ({
  connection,
}) => (
  <tr>
    <td>
      <span
        className={`hubble-pod-direction is-${connection.direction}`}
        title={connection.direction}
      >
        <span className="hubble-pod-direction-glyph">
          {connection.direction === 'outbound' ? '⬆' : '⬇'}
        </span>
        {connection.direction === 'outbound' ? 'Out' : 'In'}
      </span>
    </td>
    <td className="hubble-pod-modal-mono">
      {connection.peerPod ||
        connection.peerWorkload ||
        connection.peerIp ||
        connection.peerId ||
        'unknown'}
    </td>
    <td>{connection.peerWorkload || '—'}</td>
    <td>{connection.peerNamespace || 'external'}</td>
    <td className="hubble-pod-modal-mono">{connection.peerIp || '—'}</td>
    <td className="hubble-pod-modal-mono">
      {connection.port ? `${connection.port} ${connection.protocol}` : '—'}
    </td>
    <td>{formatVerdicts(connection.verdictCounts) || '—'}</td>
    <td>{formatDropReason(connection.dropReasons) || '—'}</td>
    <td>{formatLastSeen(connection.lastSeen)}</td>
    <td className="text-right">{connection.flowCount}</td>
  </tr>
)

const formatVerdicts = (counts: Record<string, number>): string => {
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([verdict, count]) => `${verdict.toLowerCase()} ${count}`)
  return parts.join(', ')
}

const formatDropReason = (reasons: Record<string, number>): string => {
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]
  return top ? `${top[0]} (${top[1]})` : ''
}

const graphY = (index: number, total: number): number => {
  if (total <= 1) return 140
  return 48 + (184 / (total - 1)) * index
}

const edgeWidth = (flowCount: number): number =>
  Math.max(2, Math.min(8, Math.log10(flowCount + 1) * 2.4))

const newerTime = (a: string, b: string): string => {
  if (!a) return b
  if (!b) return a
  return new Date(b).getTime() > new Date(a).getTime() ? b : a
}

const formatLastSeen = (iso: string): string => {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso || '—'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default PodConnectionsPanel
