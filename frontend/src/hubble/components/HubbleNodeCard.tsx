import React from 'react'
import {HubbleNode} from 'src/hubble/types'
import {NodeTrafficStats} from 'src/hubble/utils/nodeStats'
import {CARD_WIDTH} from 'src/hubble/utils/cardLayout'
interface Props {
  node: HubbleNode
  stats: NodeTrafficStats
  x: number
  y: number
  height: number
  isSelected: boolean
  isNeighbor: boolean
  isDimmed: boolean
  // isFocusNs marks workloads inside the labeled namespace region, where the
  // namespace subtitle would be redundant.
  isFocusNs?: boolean
  // isCrossNs is only set when CrossNsMode === 'dim'. Renders the card at
  // reduced opacity (Hubble UI's style for out-of-scope peers).
  isCrossNs?: boolean
  showDrillAction: boolean
  isDragging?: boolean
  onSelect?: () => void
  onDrillDown?: () => void
  onDragStart?: (clientX: number, clientY: number) => void
}

const formatFlows = (n: number): string => n.toLocaleString()

const nodeTitle = (node: HubbleNode): string => {
  if (node.kind === 'external') {
    return node.fqdn || node.label || 'Unknown External'
  }
  if (node.kind === 'workload' && node.name?.includes('/')) {
    const parts = node.name.split('/')
    return parts[parts.length - 1] || node.name
  }
  return node.name || node.label || node.id
}

const nodeSubtitle = (node: HubbleNode, title: string): string | null => {
  if (node.kind === 'external') return null
  if (node.groupedKind === 'namespace-group') {
    const count = node.groupedMemberCount || 0
    return `${count} workload${count === 1 ? '' : 's'} (grouped)`
  }
  const subtitle = node.namespace || node.name || null
  // Namespace cards resolve title and subtitle to the same namespace name;
  // showing it twice is noise, so drop the redundant subtitle.
  return subtitle && subtitle !== title ? subtitle : null
}

const HubbleNodeCard: React.FC<Props> = ({
  node,
  stats,
  x,
  y,
  height,
  isSelected,
  isNeighbor,
  isDimmed,
  isFocusNs,
  isCrossNs,
  showDrillAction,
  isDragging,
  onSelect,
  onDrillDown,
  onDragStart,
}) => {
  const inFlows = stats.inFlows
  const outFlows = stats.outFlows
  const hasDenied = stats.deniedFlows > 0
  // "Recovered" = an edge attached to this node had DROPPED flows within the
  // 5m window, but the recent short interval is clean. We only surface this
  // when there is no live deny so the two badges don't overlap.
  const hasRecovered = stats.hadRecentDeny && !hasDenied
  const title = nodeTitle(node)
  const subtitle = nodeSubtitle(node, title)
  const topInPort = node.topInPorts?.[0]
  const topOutPort = node.topOutPorts?.[0]

  const classNames = [
    'hubble-node-card',
    `hubble-node-card--${node.kind}`,
    node.system ? 'hubble-node-card--system' : '',
    isSelected ? 'is-selected' : '',
    isNeighbor ? 'is-neighbor' : '',
    isDimmed ? 'is-dimmed' : '',
    isFocusNs ? 'is-focus-ns' : '',
    isCrossNs ? 'is-cross-ns' : '',
    isDragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDragStart && onDragStart(e.clientX, e.clientY)
  }

  return (
    <div
      className={classNames}
      style={{left: x, top: y, width: CARD_WIDTH, height}}
    >
      <div
        className="hubble-node-card-grip"
        title="드래그하여 카드 위치 이동"
        aria-label="Drag card"
        onMouseDown={handleDragStart}
      />
      <div className="hubble-node-card-main">
        <div
          className="hubble-node-card-body"
          onClick={e => {
            e.stopPropagation()
            onSelect && onSelect()
          }}
        >
          <div className="hubble-node-card-header">
            <span
              className="hubble-node-card-kind"
              title={
                node.groupedKind === 'namespace-group'
                  ? 'drilldown 중인 namespace와 통신하는 다른 namespace의 워크로드들을 묶어 표시'
                  : node.kind === 'external'
                  ? '클러스터 밖 또는 FQDN으로 식별되는 외부 대상'
                  : node.kind === 'workload'
                  ? 'Kubernetes Pod/Deployment 등 워크로드 단위'
                  : 'Kubernetes 네임스페이스 단위로 집계된 트래픽'
              }
            >
              {node.groupedKind === 'namespace-group'
                ? 'NS group'
                : node.kind === 'external'
                ? 'External'
                : node.kind === 'workload'
                ? 'Workload'
                : 'NS'}
            </span>
            {hasDenied && (
              <span
                className="hubble-node-card-badge hubble-node-card-badge--denied"
                title="이 노드와 연결된 flow 중 정책에 의해 차단(deny)된 것이 있습니다"
              >
                Dropped {formatFlows(stats.deniedFlows)}
              </span>
            )}
            {hasRecovered && (
              <span
                className="hubble-node-card-badge hubble-node-card-badge--recovered"
                title="최근 윈도우(기본 5분) 내에 이 노드 연결의 일부 flow가 차단(deny)되었지만, 짧은 최근 구간(기본 10초)에서는 정상 처리됨"
              >
                ⚠ recovered
              </span>
            )}
          </div>
          <div className="hubble-node-card-title" title={title}>
            {title}
          </div>
          {subtitle && !isFocusNs && (
            <div
              className="hubble-node-card-subtitle"
              title="Kubernetes 네임스페이스"
            >
              {subtitle}
            </div>
          )}

          {topInPort && (
            <div
              className="hubble-node-card-port hubble-node-card-port--in"
              title={`이 노드가 수신(서비스)하는 포트 — 들어온 flow의 목적지 포트 기준 (${topInPort.count.toLocaleString()} flows)`}
            >
              <span className="hubble-node-card-port-dir">⬇</span>
              {topInPort.name}
            </div>
          )}
          {topOutPort && (
            <div
              className="hubble-node-card-port hubble-node-card-port--out"
              title={`이 노드가 나가서 접속하는 상대 포트 — 나간 flow의 목적지 포트 기준 (${topOutPort.count.toLocaleString()} flows)`}
            >
              <span className="hubble-node-card-port-dir">⬆</span>
              {topOutPort.name}
            </div>
          )}

          {(node.topExternalIPs?.length ?? 0) > 0 && (
            <div
              className="hubble-node-card-ext-ips"
              title="이 Unknown External 뒤에 숨은 실제 외부 IP 상위 목록 (연결 클릭 → Connections 탭에서 상세 확인). DNS visibility를 켜면 도메인 이름으로 분해됩니다."
            >
              {node.topExternalIPs!.map(ip => (
                <div className="hubble-node-card-ext-ip" key={ip.name}>
                  {ip.name}
                </div>
              ))}
            </div>
          )}

          <div className="hubble-node-card-metrics">
            <span
              className="hubble-node-card-metric"
              title="현재 집계 윈도우에서 다른 노드로부터 들어온 flow 이벤트 수 (관측 이벤트 기준 — 패킷/바이트 양이 아님)"
            >
              <span className="hubble-node-card-metric-label">In</span>
              <span className="hubble-node-card-metric-value">
                {formatFlows(inFlows)}
              </span>
            </span>
            <span
              className="hubble-node-card-metric"
              title="현재 집계 윈도우에서 다른 노드로 나간 flow 이벤트 수 (관측 이벤트 기준 — 패킷/바이트 양이 아님)"
            >
              <span className="hubble-node-card-metric-label">Out</span>
              <span className="hubble-node-card-metric-value">
                {formatFlows(outFlows)}
              </span>
            </span>
          </div>
          {hasDenied &&
            stats.ingressDeniedFlows > 0 &&
            stats.egressDeniedFlows > 0 && (
              <div className="hubble-node-card-drops">
                <span>
                  Ingress drop {formatFlows(stats.ingressDeniedFlows)}
                </span>
                <span>Egress drop {formatFlows(stats.egressDeniedFlows)}</span>
              </div>
            )}
        </div>
        {showDrillAction && (
          <button
            type="button"
            className="hubble-node-card-action"
            title="이 네임스페이스 안의 워크로드별 서비스 맵으로 이동"
            onClick={e => {
              e.stopPropagation()
              onDrillDown && onDrillDown()
            }}
          >
            Open namespace
          </button>
        )}
      </div>
    </div>
  )
}

export default HubbleNodeCard
