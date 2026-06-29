import React from 'react'
import {HubbleNode} from 'src/hubble/types'
import {NodeTrafficStats} from 'src/hubble/utils/nodeStats'
import {CARD_WIDTH} from 'src/hubble/utils/cardLayout'
import {
  NodeShareDisplay,
  shareTooltipSuffix,
} from 'src/hubble/utils/trafficShare'

interface Props {
  node: HubbleNode
  stats: NodeTrafficStats
  shareDisplay: NodeShareDisplay
  x: number
  y: number
  height: number
  isSelected: boolean
  isNeighbor: boolean
  isDimmed: boolean
  // isFocusNs marks workloads living in the active drilldown namespace —
  // applies a subtle accent so the operator's scope is visually obvious.
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

const nodeSubtitle = (node: HubbleNode): string | null => {
  if (node.kind === 'external') return null
  if (node.groupedKind === 'namespace-group') {
    const count = node.groupedMemberCount || 0
    return `${count} workload${count === 1 ? '' : 's'} (grouped)`
  }
  return node.namespace || node.name || null
}

const ingressTooltip = (denied?: boolean): string =>
  denied
    ? '들어오는(Ingress) 트래픽 중 일부가 Cilium 정책 등으로 차단되었습니다.'
    : '들어오는(Ingress) 트래픽: 다른 노드에서 이 대상으로 들어오는 연결입니다. 현재 구간에서 차단된 flow가 없습니다.'

const egressTooltip = (denied?: boolean): string =>
  denied
    ? '나가는(Egress) 트래픽 중 일부가 Cilium 정책 등으로 차단되었습니다.'
    : '나가는(Egress) 트래픽: 이 대상에서 밖으로 나가는 연결입니다. 현재 구간에서 차단된 flow가 없습니다.'

const HubbleNodeCard: React.FC<Props> = ({
  node,
  stats,
  shareDisplay,
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
  const inFlows = stats.inFlows + stats.internalFlows
  const outFlows = stats.outFlows
  const displayInFlows = shareDisplay.inValue ?? inFlows
  const displayOutFlows = shareDisplay.outValue ?? outFlows
  const hasDenied = stats.deniedFlows > 0
  // "Recovered" = an edge attached to this node had DROPPED flows within the
  // 5m window, but the recent short interval is clean. We only surface this
  // when there is no live deny so the two badges don't overlap.
  const hasRecovered = stats.hadRecentDeny && !hasDenied
  const hasInternal = stats.internalFlows > 0
  const subtitle = nodeSubtitle(node)
  const topPort = node.topPorts?.[0]
  const labelChips = node.labels?.slice(0, 4) ?? []
  const inShare = shareDisplay.inShare
  const outShare = shareDisplay.outShare

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
                : 'Namespace'}
            </span>
            {hasDenied && (
              <span
                className="hubble-node-card-badge hubble-node-card-badge--denied"
                title="이 노드와 연결된 flow 중 정책에 의해 차단(deny)된 것이 있습니다"
              >
                deny
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
          <div className="hubble-node-card-title" title={nodeTitle(node)}>
            {nodeTitle(node)}
          </div>
          {subtitle && (
            <div
              className="hubble-node-card-subtitle"
              title="Kubernetes 네임스페이스"
            >
              {subtitle}
            </div>
          )}

          <div className="hubble-node-card-directions">
            <span
              className={[
                'hubble-node-card-direction',
                stats.ingressDenied ? 'is-denied' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={ingressTooltip(stats.ingressDenied)}
            >
              <span
                className="hubble-node-card-lock"
                aria-hidden="true"
                title={
                  stats.ingressDenied ? '수신 차단 flow 있음' : '수신 차단 없음'
                }
              >
                {stats.ingressDenied ? '🔒' : '🔓'}
              </span>
              → Ingress
            </span>
            <span
              className={[
                'hubble-node-card-direction',
                stats.egressDenied ? 'is-denied' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={egressTooltip(stats.egressDenied)}
            >
              Egress →
              <span
                className="hubble-node-card-lock"
                aria-hidden="true"
                title={
                  stats.egressDenied ? '송신 차단 flow 있음' : '송신 차단 없음'
                }
              >
                {stats.egressDenied ? '🔒' : '🔓'}
              </span>
            </span>
          </div>

          {topPort && (
            <div
              className="hubble-node-card-port"
              title={`가장 많이 관측된 포트·프로토콜 (${topPort.count.toLocaleString()} flows). L4/L7 flow에서 집계됩니다.`}
            >
              {topPort.name}
            </div>
          )}

          {labelChips.length > 0 && (
            <div
              className="hubble-node-card-labels"
              title="Cilium/Kubernetes endpoint identity 라벨 (flow에서 수집)"
            >
              {labelChips.map(label => (
                <span
                  key={label}
                  className="hubble-node-card-label"
                  title={label}
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          <div className="hubble-node-card-metrics">
            <span
              className="hubble-node-card-metric"
              title={`들어오는 flow 수 (내부 loopback 포함)${shareTooltipSuffix(
                inShare,
                shareDisplay,
                'in'
              )}`}
            >
              <span className="hubble-node-card-metric-label">In</span>
              <span className="hubble-node-card-metric-value">
                {formatFlows(displayInFlows)}
              </span>
              {inShare && (
                <span
                  className={[
                    'hubble-node-card-metric-share',
                    inShare === '기준'
                      ? 'hubble-node-card-metric-share--reference'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {inShare}
                </span>
              )}
            </span>
            <span
              className="hubble-node-card-metric"
              title={`나가는 flow 수${shareTooltipSuffix(
                outShare,
                shareDisplay,
                'out'
              )}`}
            >
              <span className="hubble-node-card-metric-label">Out</span>
              <span className="hubble-node-card-metric-value">
                {formatFlows(displayOutFlows)}
              </span>
              {outShare && (
                <span
                  className={[
                    'hubble-node-card-metric-share',
                    outShare === '기준'
                      ? 'hubble-node-card-metric-share--reference'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {outShare}
                </span>
              )}
            </span>
          </div>
          {hasInternal && (
            <div
              className="hubble-node-card-internal"
              title="같은 노드 내부에서 발생한 flow (In/Out과 별도 표시)"
            >
              ↻ {formatFlows(stats.internalFlows)} internal
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
