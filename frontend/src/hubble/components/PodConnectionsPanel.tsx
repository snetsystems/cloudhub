import React, {useEffect, useMemo, useState} from 'react'
import {
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
} from 'src/reusable_ui'
import {HubbleFlowRecord} from 'src/hubble/types'
import {
  PodOption,
  PodConnectionSummary,
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
      {pods.length > 0 && (
        <>
          <div className="hubble-pod-list">
            {pods.slice(0, 8).map(pod => (
              <button
                type="button"
                key={pod.key}
                className={`hubble-pod-chip ${
                  pod.key === selectedPodKey ? 'is-selected' : ''
                }`}
                onClick={() => setSelectedPodKey(pod.key)}
                title={`${pod.key} connections`}
              >
                <span className="hubble-pod-chip-name">{pod.pod}</span>
                <span className="hubble-pod-chip-meta">
                  {pod.workload || 'unknown'} · {pod.flowCount}
                </span>
              </button>
            ))}
          </div>
          {pods.length > 8 && (
            <div className="hubble-pod-more">+{pods.length - 8} more pods</div>
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
              <table className="table v-center table-highlight hubble-pod-modal-table">
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
        <defs>
          <marker
            id="hubble-pod-arrow-ok"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="#65b7ff" />
          </marker>
          <marker
            id="hubble-pod-arrow-drop"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="#ff6f6f" />
          </marker>
        </defs>
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
  const center = {x: 450, y: 140}
  const peerX = connection.direction === 'inbound' ? 170 : 730
  const peerY = graphY(index, total)
  const dropped = (connection.verdictCounts.DROPPED || 0) > 0
  const color = dropped ? '#ff6f6f' : '#65b7ff'
  const marker = dropped
    ? 'url(#hubble-pod-arrow-drop)'
    : 'url(#hubble-pod-arrow-ok)'
  const from =
    connection.direction === 'inbound' ? {x: peerX + 76, y: peerY} : center
  const to =
    connection.direction === 'inbound' ? center : {x: peerX - 76, y: peerY}
  const labelX =
    connection.direction === 'inbound' ? center.x - 112 : center.x + 112
  const labelY = peerY - 10
  const peerLabel =
    connection.peerPod ||
    connection.peerWorkload ||
    connection.peerIp ||
    connection.peerId ||
    'unknown'

  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={edgeWidth(connection.flowCount)}
        markerEnd={marker}
        opacity={0.88}
      />
      <text
        x={labelX}
        y={labelY}
        className="hubble-pod-graph-edge-label"
        textAnchor="middle"
      >
        {formatGraphEdgeLabel(connection)}
      </text>
      <GraphNode
        x={peerX}
        y={peerY}
        label={peerLabel}
        meta={connection.peerWorkload || connection.peerNamespace || 'external'}
        grouped={connection.key.includes('|group:')}
      />
      <title>
        {connection.direction === 'inbound'
          ? `${peerLabel} -> ${selectedLabel}`
          : `${selectedLabel} -> ${peerLabel}`}
      </title>
    </g>
  )
}

const GraphNode: React.FC<{
  x: number
  y: number
  label: string
  meta: string
  selected?: boolean
  grouped?: boolean
}> = ({x, y, label, meta, selected, grouped}) => (
  <g transform={`translate(${x - 76}, ${y - 24})`}>
    <rect
      width="152"
      height="48"
      rx="5"
      className={`hubble-pod-graph-node ${selected ? 'is-selected' : ''} ${
        grouped ? 'is-grouped' : ''
      }`}
    />
    <text x="10" y="20" className="hubble-pod-graph-node-label">
      {truncateMiddle(label, 21)}
    </text>
    <text x="10" y="37" className="hubble-pod-graph-node-meta">
      {truncateMiddle(meta, 20)}
    </text>
    <title>{label}</title>
  </g>
)

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
        {connection.direction === 'outbound' ? 'OUT' : 'IN'}
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

const formatGraphEdgeLabel = (connection: PodConnectionSummary): string => {
  if (connection.key.includes('|group:DNS')) {
    const dropped = connection.verdictCounts.DROPPED || 0
    return dropped > 0
      ? `DNS · DROP ${dropped}`
      : `DNS · ${connection.flowCount}`
  }
  if (connection.key.includes('|group:External / IP')) {
    const dropped = connection.verdictCounts.DROPPED || 0
    return dropped > 0
      ? `External · DROP ${dropped}`
      : `External · ${connection.flowCount}`
  }
  const port = connection.port
    ? `${connection.port} ${connection.protocol}`
    : ''
  const dropped = connection.verdictCounts.DROPPED || 0
  if (dropped > 0) return `${port || 'flow'} · dropped ${dropped}`
  return `${port || 'flow'} · ${connection.flowCount}`
}

const graphY = (index: number, total: number): number => {
  if (total <= 1) return 140
  return 48 + (184 / (total - 1)) * index
}

const edgeWidth = (flowCount: number): number =>
  Math.max(2, Math.min(8, Math.log10(flowCount + 1) * 2.4))

const truncateMiddle = (value: string, max: number): string => {
  if (!value || value.length <= max) return value
  const half = Math.floor((max - 1) / 2)
  return `${value.slice(0, half)}…${value.slice(value.length - half)}`
}

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
