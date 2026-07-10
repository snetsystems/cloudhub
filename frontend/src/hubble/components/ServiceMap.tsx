import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {HubbleEdge, HubbleSnapshot} from 'src/hubble/types'
import HubbleNodeCard from 'src/hubble/components/HubbleNodeCard'
import {useCardDrag} from 'src/hubble/hooks/useCardDrag'
import {useTransformPan} from 'src/hubble/hooks/useTransformPan'
import {
  computeContentBounds,
  computeClusterNamespaceRegion,
  ContentBounds,
  expandContentBounds,
  cardHeightForNode,
  layoutCards,
  partitionMapRegionNodeIds,
  toRenderPosition,
} from 'src/hubble/utils/cardLayout'
import {
  filterDisplayEdges,
  TOP_EDGES_LIMIT,
  TopologyNoiseFilters,
  VerdictFilter,
  visibleNodes,
} from 'src/hubble/utils/filterEdges'
import {edgeVerdict, edgeVerdictColor} from 'src/hubble/utils/edgeVerdict'
import {
  CrossNsMode,
  isCrossNsNodeId,
} from 'src/hubble/utils/groupExternalNamespaces'
import {buildEdgePath, computeEdgeAnchors} from 'src/hubble/utils/edgeAnchors'
import {buildNodeStats} from 'src/hubble/utils/nodeStats'

interface Props {
  snapshot: HubbleSnapshot | null
  hideSystemNodes: boolean
  simplifiedView: boolean
  verdictFilter: VerdictFilter
  noiseFilters: TopologyNoiseFilters
  crossNsMode: CrossNsMode
  drilldown: string | null
  detailEdgeId: string | null
  onNodeDrillDown?: (nodeId: string) => void
  onNodeSelect?: (nodeId: string) => void
  onEdgeDetails?: (edgeId: string, src: string, dst: string) => void
  onClearSelection?: () => void
  onHelp?: () => void
}

// During drilldown the Applications region wraps the focus Namespace region.
// Because both regions share their topmost cards, we lift the Applications
// header above the Namespace header (extra top) and pad the sides/bottom so
// the nesting reads like Hubble UI. The extra top must clear the Applications
// header (~54px, see .hubble-map-region-header) so it doesn't overlap the inner
// Namespace region's box. DRILLDOWN_TOP_RESERVE reserves matching room at the
// top of the content so the raised Applications header isn't clipped after
// fit-to-viewport: it must cover the region's total rise above its top card
// (NAMESPACE_REGION_TOP_PADDING 64 + extra top 64) minus the canvas padding.
const DRILLDOWN_TOP_RESERVE = 80
const APPLICATIONS_DRILLDOWN_PADDING = {top: 64, side: 16, bottom: 16}

const edgeWidth = (value: number, max: number): number => {
  if (!max || max <= 0) return 1.5
  const norm = Math.log(1 + value) / Math.log(1 + max)
  return 1.5 + norm * 4
}

// renderRecoveredBadge draws a small ⚠ at the edge midpoint to signal that
// the edge had DROPPED flows within the window but recent traffic is clean.
// The edge color itself stays green (current state of truth), so this badge
// is the only hint that something happened recently.
const renderRecoveredBadge = (
  from: {x: number; y: number},
  to: {x: number; y: number},
  edge: HubbleEdge,
  dimmed: boolean,
  onClick?: (e: React.MouseEvent) => void
) => {
  const cx = (from.x + to.x) / 2
  const cy = (from.y + to.y) / 2
  const droppedTotal = edge.verdictCounts?.DROPPED ?? 0
  const title = `최근 5분 윈도우 내 ${droppedTotal.toLocaleString()}건 drop 발생 — 현재 짧은 구간(기본 10초)에서는 정상 트래픽 흐름`
  return (
    <g
      className={['hubble-edge-recovered-badge', dimmed ? 'is-dimmed' : '']
        .filter(Boolean)
        .join(' ')}
      transform={`translate(${cx}, ${cy})`}
      onClick={onClick}
    >
      <title>{title}</title>
      <circle r={9} className="hubble-edge-recovered-badge-bg" />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        className="hubble-edge-recovered-badge-text"
      >
        ⚠
      </text>
    </g>
  )
}

const edgeId = (src: string, dst: string): string => `${src}|${dst}`

type MapRegionTone = 'external' | 'applications' | 'system'

// Region header sits inside the region box so it always tracks the area.
const MapRegionHeader: React.FC<{
  tone: MapRegionTone
  title: string
  subtitle: string
  count: number
  isDragging?: boolean
  onDragStart: (clientX: number, clientY: number) => void
}> = ({
  tone,
  title,
  subtitle,
  count,
  isDragging = false,
  onDragStart,
}) => (
  <div
    className={`hubble-map-region-header hubble-map-region-header--${tone}${
      isDragging ? ' is-dragging' : ''
    }`}
    onMouseDown={e => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      onDragStart(e.clientX, e.clientY)
    }}
  >
    <div className="hubble-map-region-header-text">
      <strong className="hubble-map-region-title">{title}</strong>
      <span className="hubble-map-region-subtitle">{subtitle}</span>
    </div>
    <span className="hubble-map-region-count">{count.toLocaleString()}</span>
  </div>
)

const NamespaceRegionHeader: React.FC<{
  namespace: string
  count: number
  isDragging?: boolean
  onDragStart: (clientX: number, clientY: number) => void
}> = ({namespace, count, isDragging = false, onDragStart}) => (
  <div
    className={`hubble-namespace-region-header${
      isDragging ? ' is-dragging' : ''
    }`}
    onMouseDown={e => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      onDragStart(e.clientX, e.clientY)
    }}
  >
    <span className="hubble-namespace-region-kind">Namespace</span>
    <strong>{namespace}</strong>
    <span>{count.toLocaleString()} workloads</span>
  </div>
)

// isFocusNs returns true for workload nodes living in the active drilldown
// namespace — i.e. the cards we want to highlight as "this is your scope".
const isFocusNsNodeId = (
  nodeId: string,
  drilldownNamespace: string | null
): boolean =>
  !!drilldownNamespace && nodeId.startsWith(`wl:${drilldownNamespace}/`)

const isRegionDragging = (
  draggingRegionMembers: Set<string> | null,
  memberIds: ReadonlySet<string>
): boolean =>
  !!draggingRegionMembers &&
  memberIds.size > 0 &&
  [...memberIds].every(id => draggingRegionMembers.has(id))

const ServiceMap: React.FC<Props> = ({
  snapshot,
  hideSystemNodes,
  simplifiedView,
  verdictFilter,
  noiseFilters,
  crossNsMode,
  drilldown,
  detailEdgeId,
  onNodeDrillDown,
  onNodeSelect,
  onEdgeDetails,
  onClearSelection,
  onHelp,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // Drilling into (or out of) a namespace swaps the node id scheme (e.g.
  // "ns:cloudhub" -> "wl:cloudhub/*"), so a selection made before the
  // transition can no longer match anything in the new node/edge set. Left
  // uncleared, that stale selection still counts as "focused", which dims
  // every node/edge since none of them connect to it. Clear it synchronously
  // during render (rather than in an effect) so the very first render of the
  // new view is already undimmed — the standard React pattern for resetting
  // state when a prop changes: https://react.dev/learn/you-might-not-need-an-effect
  const [selectionDrilldown, setSelectionDrilldown] = useState(drilldown)
  if (selectionDrilldown !== drilldown) {
    setSelectionDrilldown(drilldown)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }

  // systemFilteredNodes: nodes after the "Hide system NS" filter. Verdict
  // filter is applied on top by trimming orphans from this set further down.
  const systemFilteredNodes = useMemo(
    () => visibleNodes(snapshot?.nodes || [], hideSystemNodes, noiseFilters),
    [snapshot, hideSystemNodes, noiseFilters]
  )

  const systemFilteredNodeIds = useMemo(
    () => new Set(systemFilteredNodes.map(n => n.id)),
    [systemFilteredNodes]
  )

  // verdictFilteredEdges: all non-self-loop edges among system-filtered nodes
  // that pass the verdict filter. Used both for deriving visible nodes (so
  // orphans disappear when "Denied only" is selected) and for neighbor
  // lookups (visibleEdges below).
  const verdictFilteredEdges = useMemo(() => {
    if (!snapshot) return []
    return (snapshot.edges || []).filter(e => {
      if (e.src === e.dst) return false
      if (
        !systemFilteredNodeIds.has(e.src) ||
        !systemFilteredNodeIds.has(e.dst)
      ) {
        return false
      }
      const denied = e.verdictCounts?.DROPPED ?? 0
      if (verdictFilter === 'denied' && denied === 0) return false
      if (verdictFilter === 'allowed' && denied > 0) return false
      return true
    })
  }, [snapshot, systemFilteredNodeIds, verdictFilter])

  // Final node set: when a verdict filter is active, hide nodes that aren't
  // touched by any remaining edge (otherwise the screen fills with disconnected
  // cards). The selected node stays visible so selection doesn't vanish out
  // from under the user when toggling the filter.
  const nodes = useMemo(() => {
    if (verdictFilter === 'all') return systemFilteredNodes
    const connected = new Set<string>()
    for (const e of verdictFilteredEdges) {
      connected.add(e.src)
      connected.add(e.dst)
    }
    if (selectedNodeId) connected.add(selectedNodeId)
    return systemFilteredNodes.filter(n => connected.has(n.id))
  }, [systemFilteredNodes, verdictFilteredEdges, verdictFilter, selectedNodeId])

  const nodeStats = useMemo(
    () => (snapshot ? buildNodeStats(snapshot) : new Map()),
    [snapshot]
  )

  const visibleNodeIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes])

  const visibleEdges = useMemo(
    () =>
      verdictFilteredEdges.filter(
        e => visibleNodeIds.has(e.src) && visibleNodeIds.has(e.dst)
      ),
    [verdictFilteredEdges, visibleNodeIds]
  )

  const neighborIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const ids = new Set<string>()
    for (const e of visibleEdges) {
      if (e.src === selectedNodeId) ids.add(e.dst)
      if (e.dst === selectedNodeId) ids.add(e.src)
    }
    return ids
  }, [selectedNodeId, visibleEdges])

  const cardHeights = useMemo(() => {
    const map = new Map<string, number>()
    for (const node of nodes) {
      map.set(node.id, cardHeightForNode(node, nodeStats.get(node.id)))
    }
    return map
  }, [nodes, nodeStats])

  const focusNamespaceNodeIds = useMemo(() => {
    if (!drilldown) return new Set<string>()
    const prefix = `wl:${drilldown}/`
    return new Set(
      nodes.filter(node => node.id.startsWith(prefix)).map(node => node.id)
    )
  }, [nodes, drilldown])

  const {
    setViewportRef,
    viewportRef,
    pan,
    scale,
    getScale,
    handleMouseDownCapture,
    isPanning,
    isTransforming,
    consumeDidPan,
    centerOnContent,
    fitToViewport,
  } = useTransformPan(!!snapshot)

  // Viewport width/height ratio, quantized to 0.25 steps so minor resizes
  // don't reshuffle the layout. Drives how wide the applications grid grows
  // (up to one row per block on wide screens).
  const [viewportAspect, setViewportAspect] = useState<number | null>(null)
  const hasSnapshot = !!snapshot

  useEffect(() => {
    const el = viewportRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 50 && h > 50) {
        setViewportAspect(Math.round((w / h) * 4) / 4)
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [viewportRef, hasSnapshot])

  const basePositions = useMemo(
    () =>
      layoutCards(nodes, cardHeights, focusNamespaceNodeIds, viewportAspect),
    [nodes, cardHeights, focusNamespaceNodeIds, viewportAspect]
  )

  const layoutKey = useMemo(
    () =>
      [
        drilldown ?? 'overview',
        hideSystemNodes ? 'hide-sys' : 'show-sys',
        String(viewportAspect ?? 'na'),
        nodes
          .map(n => n.id)
          .sort()
          .join('|'),
      ].join('::'),
    [nodes, drilldown, hideSystemNodes, viewportAspect]
  )

  const {
    applyPositions,
    startDrag,
    startRegionDrag,
    draggingNodeId,
    draggingRegionMembers,
    consumeDidDrag,
    resetOffsets,
  } = useCardDrag(layoutKey, getScale, drilldown ?? 'overview')

  const positions = applyPositions(basePositions)

  const sessionBoundsRef = useRef<ContentBounds | null>(null)

  useEffect(() => {
    sessionBoundsRef.current = null
  }, [layoutKey])

  const contentBounds = useMemo(() => {
    const current = computeContentBounds(positions)
    const next = expandContentBounds(sessionBoundsRef.current, current)
    sessionBoundsRef.current = next
    if (!drilldown) return next
    // Reserve top space so the outer Applications header (lifted above the
    // Namespace header) stays inside the canvas after fit-to-viewport.
    return {
      ...next,
      minY: next.minY - DRILLDOWN_TOP_RESERVE,
      height: next.height + DRILLDOWN_TOP_RESERVE,
      offsetY: next.offsetY + DRILLDOWN_TOP_RESERVE,
    }
  }, [positions, drilldown])

  const {width, height} = contentBounds

  const renderPositionById = useMemo(() => {
    const map = new Map<string, typeof positions[0]>()
    for (const p of positions) {
      map.set(p.id, toRenderPosition(p, contentBounds))
    }
    return map
  }, [positions, contentBounds])

  const focusNamespaceRegion = useMemo(
    () =>
      computeClusterNamespaceRegion(
        Array.from(renderPositionById.values()),
        focusNamespaceNodeIds
      ),
    [renderPositionById, focusNamespaceNodeIds]
  )

  const mapRegionNodeIds = useMemo(() => partitionMapRegionNodeIds(nodes), [
    nodes,
  ])

  const externalMapRegion = useMemo(
    () =>
      computeClusterNamespaceRegion(
        Array.from(renderPositionById.values()),
        mapRegionNodeIds.external
      ),
    [renderPositionById, mapRegionNodeIds]
  )

  const applicationsMapRegion = useMemo(
    () =>
      computeClusterNamespaceRegion(
        Array.from(renderPositionById.values()),
        mapRegionNodeIds.applications,
        drilldown ? APPLICATIONS_DRILLDOWN_PADDING : undefined
      ),
    [renderPositionById, mapRegionNodeIds, drilldown]
  )

  const systemMapRegion = useMemo(
    () =>
      computeClusterNamespaceRegion(
        Array.from(renderPositionById.values()),
        mapRegionNodeIds.system
      ),
    [renderPositionById, mapRegionNodeIds]
  )

  const positionById = useMemo(() => {
    const map = new Map<string, {x: number; y: number}>()
    for (const p of positions) {
      map.set(p.id, {x: p.x, y: p.y})
    }
    return map
  }, [positions])

  const beginRegionDrag = useCallback(
    (
      regionKey: string,
      memberIds: ReadonlySet<string>,
      clientX: number,
      clientY: number
    ) => {
      startRegionDrag(regionKey, memberIds, clientX, clientY, positionById)
    },
    [positionById, startRegionDrag]
  )

  const displayEdges = useMemo(() => {
    if (!snapshot) return []
    return filterDisplayEdges(snapshot.edges || [], {
      topN: TOP_EDGES_LIMIT,
      hideSelfLoops: true,
      visibleNodeIds,
      simplifiedView,
      verdictFilter,
    })
  }, [snapshot, visibleNodeIds, simplifiedView, verdictFilter])

  const edgeAnchors = useMemo(
    () => computeEdgeAnchors(displayEdges, renderPositionById),
    [displayEdges, renderPositionById]
  )

  const maxEdgeValue = useMemo(
    () =>
      displayEdges.reduce(
        (acc, e) => (e.flowCount > acc ? e.flowCount : acc),
        0
      ),
    [displayEdges]
  )

  const hiddenEdgeCount = useMemo(() => {
    if (!snapshot || !simplifiedView) return 0
    const all = filterDisplayEdges(snapshot.edges || [], {
      topN: TOP_EDGES_LIMIT,
      hideSelfLoops: true,
      visibleNodeIds,
      simplifiedView: false,
      verdictFilter,
    })
    return Math.max(0, all.length - displayEdges.length)
  }, [
    snapshot,
    visibleNodeIds,
    simplifiedView,
    verdictFilter,
    displayEdges.length,
  ])

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId || !snapshot) return null
    const sep = selectedEdgeId.indexOf('|')
    if (sep < 0) return null
    const src = selectedEdgeId.slice(0, sep)
    const dst = selectedEdgeId.slice(sep + 1)
    return snapshot.edges.find(e => e.src === src && e.dst === dst) ?? null
  }, [selectedEdgeId, snapshot])

  const hasSelectionFocus = selectedNodeId !== null || selectedEdgeId !== null

  const fittedLayoutKey = useRef('')

  useEffect(() => {
    if (fittedLayoutKey.current === layoutKey) return
    fittedLayoutKey.current = layoutKey
    fitToViewport(width, height)
  }, [layoutKey, width, height, fitToViewport])

  const handleCanvasClick = () => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    onClearSelection && onClearSelection()
  }

  const handleViewportClick = (e: React.MouseEvent) => {
    if (consumeDidPan()) return
    const target = e.target as HTMLElement
    if (
      target.classList.contains('hubble-map-viewport') ||
      target.classList.contains('hubble-map-world') ||
      target.classList.contains('hubble-map-content') ||
      target.classList.contains('hubble-map-pan-surface') ||
      target.classList.contains('hubble-edge-layer')
    ) {
      handleCanvasClick()
    }
  }

  const handleResetLayout = () => {
    sessionBoundsRef.current = null
    resetOffsets()
    fitToViewport(width, height)
  }

  if (!snapshot) {
    return <div className="hubble-service-map hubble-service-map--empty" />
  }

  return (
    <div className="hubble-service-map">
      <div className="hubble-map-toolbar">
        <div className="hubble-map-hint">
          <span className="hubble-map-level">
            {drilldown
              ? `${drilldown} 네임스페이스 — 워크로드 간 연결`
              : 'Overview — 네임스페이스 간 연결'}
            <span className="hubble-map-info" tabIndex={0}>
              <span className="hubble-map-info-icon" aria-hidden="true">
                i
              </span>
              <span
                className="hubble-map-info-tooltip"
                role="tooltip"
                aria-label="맵 사용법"
              >
                {hiddenEdgeCount > 0 && (
                  <span className="hubble-map-info-tooltip-line">
                    {`상위 ${TOP_EDGES_LIMIT}개 연결 (+${hiddenEdgeCount}개 숨김)`}
                  </span>
                )}
                <span className="hubble-map-info-tooltip-line">
                  빈 공간 드래그: 이동 · 휠: 확대/축소
                </span>
              </span>
            </span>
          </span>
        </div>
        <div className="hubble-map-toolbar-actions">
          <button
            type="button"
            className="hubble-map-reset-layout"
            onClick={() => fitToViewport(width, height)}
          >
            Fit
          </button>
          <button
            type="button"
            className="hubble-map-reset-layout"
            onClick={() => centerOnContent(width, height)}
          >
            Center
          </button>
          <button
            type="button"
            className="hubble-map-reset-layout"
            onClick={handleResetLayout}
          >
            Reset layout
          </button>
          {onHelp && (
            <button
              type="button"
              className="hubble-side-tabs-help"
              title="맵의 카드와 연결선을 읽는 방법을 예시와 함께 설명합니다"
              aria-label="Open map tutorial"
              onClick={onHelp}
            >
              ?
            </button>
          )}
        </div>
      </div>
      <div
        ref={setViewportRef}
        className={`hubble-map-viewport${isPanning ? ' is-panning' : ''}`}
        onMouseDownCapture={handleMouseDownCapture}
        onClick={handleViewportClick}
      >
        <div
          className={`hubble-map-world${
            isTransforming ? ' is-transforming' : ''
          }`}
          style={{
            width,
            height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <div className="hubble-map-content">
            <div
              className="hubble-map-pan-surface"
              style={{width, height}}
              aria-hidden="true"
            />
            {externalMapRegion && (
              <div
                className="hubble-map-region hubble-map-region--external"
                style={{
                  left: externalMapRegion.x,
                  top: externalMapRegion.y,
                  width: externalMapRegion.width,
                  height: externalMapRegion.height,
                }}
                aria-label={`External or unresolved, ${externalMapRegion.memberCount} nodes`}
              >
                <MapRegionHeader
                  tone="external"
                  title="External"
                  subtitle="Unresolved endpoints"
                  count={externalMapRegion.memberCount}
                  isDragging={isRegionDragging(
                    draggingRegionMembers,
                    mapRegionNodeIds.external
                  )}
                  onDragStart={(clientX, clientY) =>
                    beginRegionDrag(
                      'external',
                      mapRegionNodeIds.external,
                      clientX,
                      clientY
                    )
                  }
                />
              </div>
            )}
            {applicationsMapRegion && (
              <div
                className="hubble-map-region hubble-map-region--applications"
                style={{
                  left: applicationsMapRegion.x,
                  top: applicationsMapRegion.y,
                  width: applicationsMapRegion.width,
                  height: applicationsMapRegion.height,
                }}
                aria-label={`Applications, ${applicationsMapRegion.memberCount} nodes`}
              >
                <MapRegionHeader
                  tone="applications"
                  title="Applications"
                  subtitle="In-cluster workloads"
                  count={applicationsMapRegion.memberCount}
                  isDragging={isRegionDragging(
                    draggingRegionMembers,
                    mapRegionNodeIds.applications
                  )}
                  onDragStart={(clientX, clientY) =>
                    beginRegionDrag(
                      'applications',
                      mapRegionNodeIds.applications,
                      clientX,
                      clientY
                    )
                  }
                />
              </div>
            )}
            {systemMapRegion && (
              <div
                className="hubble-map-region hubble-map-region--system"
                style={{
                  left: systemMapRegion.x,
                  top: systemMapRegion.y,
                  width: systemMapRegion.width,
                  height: systemMapRegion.height,
                }}
                aria-label={`System namespaces, ${systemMapRegion.memberCount} nodes`}
              >
                <MapRegionHeader
                  tone="system"
                  title="System"
                  subtitle="Platform namespaces"
                  count={systemMapRegion.memberCount}
                  isDragging={isRegionDragging(
                    draggingRegionMembers,
                    mapRegionNodeIds.system
                  )}
                  onDragStart={(clientX, clientY) =>
                    beginRegionDrag(
                      'system',
                      mapRegionNodeIds.system,
                      clientX,
                      clientY
                    )
                  }
                />
              </div>
            )}
            {drilldown && focusNamespaceRegion && (
              <div
                className="hubble-namespace-region"
                style={{
                  left: focusNamespaceRegion.x,
                  top: focusNamespaceRegion.y,
                  width: focusNamespaceRegion.width,
                  height: focusNamespaceRegion.height,
                }}
                aria-label={`Namespace ${drilldown}, ${focusNamespaceRegion.memberCount} visible workloads`}
              >
                <NamespaceRegionHeader
                  namespace={drilldown}
                  count={focusNamespaceRegion.memberCount}
                  isDragging={isRegionDragging(
                    draggingRegionMembers,
                    focusNamespaceNodeIds
                  )}
                  onDragStart={(clientX, clientY) =>
                    beginRegionDrag(
                      'namespace',
                      focusNamespaceNodeIds,
                      clientX,
                      clientY
                    )
                  }
                />
              </div>
            )}

            <svg
              className="hubble-edge-layer"
              width={width}
              height={height}
              aria-hidden="true"
            >
              {displayEdges.map(edge => {
                const id = edgeId(edge.src, edge.dst)
                const anchors = edgeAnchors.get(id)
                if (!anchors) return null

                const verdict = edgeVerdict(edge)
                const value = edge.flowCount
                const connectedToSelection =
                  selectedNodeId === edge.src ||
                  selectedNodeId === edge.dst ||
                  selectedEdgeId === id ||
                  detailEdgeId === id
                const dimmed = hasSelectionFocus && !connectedToSelection

                const d = buildEdgePath(anchors.from, anchors.to)
                const handleEdgeClick = (e: React.MouseEvent) => {
                  e.stopPropagation()
                  setSelectedEdgeId(id)
                  setSelectedNodeId(null)
                  // One-click: edge selection drives the DetailPanel
                  // directly. The selection bar shows a short summary,
                  // the panel has the full breakdown.
                  onEdgeDetails && onEdgeDetails(id, edge.src, edge.dst)
                }
                const edgeClickHandler = dimmed ? undefined : handleEdgeClick
                return (
                  <g
                    key={id}
                    className={['hubble-edge-group', dimmed ? 'is-dimmed' : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {/* Invisible wide hit area — SVG paths with fill="none"
                        only register clicks on the painted stroke, so a thin
                        line is nearly unclickable. This transparent stroke
                        widens the hit target without changing visuals. */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      className="hubble-edge-hit"
                      onClick={edgeClickHandler}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={edgeVerdictColor(verdict)}
                      strokeWidth={edgeWidth(value, maxEdgeValue)}
                      strokeDasharray={
                        verdict === 'denied' || verdict === 'mixed'
                          ? '6 4'
                          : undefined
                      }
                      className={[
                        'hubble-edge-path',
                        dimmed ? 'is-dimmed' : '',
                        connectedToSelection ? 'is-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={edgeClickHandler}
                    />
                    {verdict === 'recovered' &&
                      renderRecoveredBadge(
                        anchors.from,
                        anchors.to,
                        edge,
                        dimmed,
                        edgeClickHandler
                      )}
                  </g>
                )
              })}
            </svg>

            {nodes.map(node => {
              const pos = renderPositionById.get(node.id)
              const absolutePos = positionById.get(node.id)
              if (!pos || !absolutePos) return null

              const stats = nodeStats.get(node.id) || {
                inFlows: 0,
                outFlows: 0,
                internalFlows: 0,
                deniedFlows: 0,
                ingressDeniedFlows: 0,
                egressDeniedFlows: 0,
                ingressDenied: false,
                egressDenied: false,
                hadRecentDeny: false,
              }

              const isSelected = selectedNodeId === node.id
              const isNeighbor =
                (!!selectedNodeId && neighborIds.has(node.id)) ||
                (!!selectedEdge &&
                  (selectedEdge.src === node.id ||
                    selectedEdge.dst === node.id))
              const isDimmed = hasSelectionFocus && !isSelected && !isNeighbor
              const isFocusNs = isFocusNsNodeId(node.id, drilldown)
              const isCrossNs =
                crossNsMode === 'dim' && isCrossNsNodeId(node.id, drilldown)

              return (
                <HubbleNodeCard
                  key={node.id}
                  node={node}
                  stats={stats}
                  x={pos.x}
                  y={pos.y}
                  height={pos.height}
                  isSelected={isSelected}
                  isNeighbor={isNeighbor}
                  isDimmed={isDimmed}
                  isFocusNs={isFocusNs}
                  isCrossNs={isCrossNs}
                  showDrillAction={
                    !drilldown && node.kind === 'namespace' && isSelected
                  }
                  isDragging={
                    draggingNodeId === node.id ||
                    !!draggingRegionMembers?.has(node.id)
                  }
                  onSelect={() => {
                    if (consumeDidDrag()) return
                    setSelectedNodeId(node.id)
                    setSelectedEdgeId(null)
                    onNodeSelect && onNodeSelect(node.id)
                  }}
                  onDragStart={(clientX, clientY) =>
                    startDrag(
                      node.id,
                      clientX,
                      clientY,
                      absolutePos.x,
                      absolutePos.y
                    )
                  }
                  onDrillDown={() =>
                    onNodeDrillDown && onNodeDrillDown(node.id)
                  }
                />
              )
            })}

          </div>
        </div>
      </div>
    </div>
  )
}

const serviceMapPropsEqual = (prev: Props, next: Props): boolean =>
  prev.snapshot === next.snapshot &&
  prev.hideSystemNodes === next.hideSystemNodes &&
  prev.simplifiedView === next.simplifiedView &&
  prev.verdictFilter === next.verdictFilter &&
  prev.noiseFilters === next.noiseFilters &&
  prev.crossNsMode === next.crossNsMode &&
  prev.drilldown === next.drilldown &&
  prev.detailEdgeId === next.detailEdgeId &&
  prev.onNodeDrillDown === next.onNodeDrillDown &&
  prev.onNodeSelect === next.onNodeSelect &&
  prev.onEdgeDetails === next.onEdgeDetails &&
  prev.onClearSelection === next.onClearSelection &&
  prev.onHelp === next.onHelp

export default React.memo(ServiceMap, serviceMapPropsEqual)
