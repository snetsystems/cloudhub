import React, {useCallback, useEffect, useState} from 'react'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {
  HubbleEdge,
  HubbleFlowRecord,
  HubblePolicyRef,
  HubblePolicyRefCount,
  HubbleSnapshot,
} from 'src/hubble/types'
import {useEdgeFlows} from 'src/hubble/hooks/useEdgeFlows'
import useAiContext from 'src/ai_chat/hooks/useAiContext'
import {
  buildConnectionContextPayload,
  buildConnectionContextSummary,
  CONNECTION_ATTACH_SKILL,
  CONNECTION_DIAGNOSE_MESSAGE,
} from 'src/hubble/utils/aiConnectionContext'
import FlowDetailsModal from 'src/hubble/components/FlowDetailsModal'
import PolicyModal from 'src/hubble/components/PolicyModal'

interface Props {
  cluster: string
  snapshot: HubbleSnapshot | null
  selectedEdgeId: string | null
  activeNodeId: string | null
  livePaused?: boolean
  onSelectEdge: (edgeId: string, src: string, dst: string) => void
  onBack: () => void
  onClose: () => void
}

const parseEdgeId = (
  edgeId: string | null
): {src: string; dst: string} | null => {
  if (!edgeId) return null
  const sep = edgeId.indexOf('|')
  if (sep < 0) return null
  return {src: edgeId.slice(0, sep), dst: edgeId.slice(sep + 1)}
}

const edgeId = (src: string, dst: string): string => `${src}|${dst}`

const shortNodeId = (id: string): string =>
  id.replace(/^(nsgrp:|ns:|wl:|ext:)/, '')

// nodeKindLabel derives an endpoint's kind from its node-id prefix, mirroring
// the kind shown on the map's node cards (NS / workload / external), so each
// side of a connection can be tagged without a snapshot lookup.
const nodeKindLabel = (id: string): string => {
  if (id.startsWith('nsgrp:')) return 'ns group'
  if (id.startsWith('ns:')) return 'ns'
  if (id.startsWith('wl:')) return 'workload'
  if (id.startsWith('ext:')) return 'external'
  return ''
}

// DetailPanel is shown when the user taps an edge. It surfaces the
// Cilium-specific data: per-verdict counts, top deny reasons, matched
// policies, and the most-recent raw flows. Empty when nothing is selected.
const DetailPanel: React.FC<Props> = ({
  cluster,
  snapshot,
  selectedEdgeId,
  activeNodeId,
  livePaused = false,
  onSelectEdge,
  onBack,
  onClose,
}) => {
  const edge = findEdge(snapshot, selectedEdgeId)
  const parsed = parseEdgeId(selectedEdgeId)
  const {flows: recentFlows, loading: flowsLoading, error: flowsError} =
    useEdgeFlows(
      cluster,
      parsed?.src ?? null,
      parsed?.dst ?? null,
      20,
      livePaused
    )
  const {sendToAiChat, clear: clearAiContext} = useAiContext()

  // The hook lives here rather than in EdgeListView: that view is called as a
  // plain function (see the warning below), so a hook inside it would attach
  // to this component's fiber. The handler goes down as a prop instead.
  const handleAiInspect = useCallback(
    (e: HubbleEdge) => {
      // One connection per question: a second click replaces the subject
      // instead of piling onto it, matching the server list's diagnose action.
      clearAiContext()

      sendToAiChat({
        autoSend: true,
        skill: CONNECTION_ATTACH_SKILL,
        prompt: CONNECTION_DIAGNOSE_MESSAGE,
        context: {
          id: `hubble-edge:${edgeId(e.src, e.dst)}`,
          type: 'k8s-connection',
          sourcePage: 'traffic-map',
          title: `${shortNodeId(e.src)} → ${shortNodeId(e.dst)}`,
          summary: buildConnectionContextSummary(e),
          payload: buildConnectionContextPayload(e),
          capturedAt: Date.now(),
        },
      })
    },
    [clearAiContext, sendToAiChat]
  )

  const [detailFlow, setDetailFlow] = useState<HubbleFlowRecord | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<HubblePolicyRef | null>(
    null
  )
  const [edgeSrcSearch, setEdgeSrcSearch] = useState('')
  const [edgeDstSearch, setEdgeDstSearch] = useState('')

  // Reset the connection-list search whenever the active node changes, so a
  // stale query from the previous node doesn't hide the new node's edges.
  useEffect(() => {
    setEdgeSrcSearch('')
    setEdgeDstSearch('')
  }, [activeNodeId])

  if (!edge) {
    if (activeNodeId) {
      // Called directly (not as JSX) so its output is inlined into this
      // component's own render tree rather than a nested component
      // boundary — keeps it visible to shallow rendering in tests.
      // WARNING: EdgeListView is typed/defined as React.FC but invoked as a
      // plain function here. It MUST NEVER have hooks (useState, useEffect,
      // useMemo, etc.) added to it. Hook calls would attach to DetailPanel's
      // fiber instead of a distinct component instance; since this call is
      // conditional, this silently violates the Rules of Hooks. If hooks are
      // needed, convert this to JSX invocation: <EdgeListView ... />
      return EdgeListView({
        snapshot,
        activeNodeId,
        onSelectEdge,
        onClose,
        srcSearch: edgeSrcSearch,
        dstSearch: edgeDstSearch,
        onSrcSearchChange: setEdgeSrcSearch,
        onDstSearchChange: setEdgeDstSearch,
        onAiInspect: handleAiInspect,
      })
    }
    return (
      <div className="hubble-panel hubble-detail-panel is-empty">
        <h4 className="hubble-panel-title">Connection details</h4>
        <div className="hubble-panel-empty">
          Select a connection, then click View details.
        </div>
      </div>
    )
  }

  // Primary verdicts are the policy decisions the operator usually cares about
  // (allowed/dropped/error/audit). Secondary verdicts are kernel datapath
  // observations (kprobe traces, service translation, L7 proxy redirect) —
  // they coexist with the primary verdict for the same packet, so showing
  // them with equal weight is noisy. We sort primaries first and apply a
  // muted style to secondaries.
  const primaryVerdicts = new Set([
    'FORWARDED',
    'DROPPED',
    'ERROR',
    'AUDIT',
  ])
  const verdicts = Object.entries(edge.verdictCounts || {}).sort((a, b) => {
    const ap = primaryVerdicts.has(a[0]) ? 0 : 1
    const bp = primaryVerdicts.has(b[0]) ? 0 : 1
    if (ap !== bp) return ap - bp
    return b[1] - a[1]
  })
  const verdictTooltip = (name: string): string => {
    switch (name) {
      case 'FORWARDED':
        return '정책 허용 후 실제 전달된 트래픽'
      case 'DROPPED':
        return '정책에 의해 차단된 트래픽'
      case 'ERROR':
        return 'datapath 처리 중 오류 (라우팅/encap 실패 등)'
      case 'AUDIT':
        return '감사 모드 — 차단했어야 하지만 실제로는 통과시킴 (정책 dry-run)'
      case 'TRACED':
        return 'kernel datapath의 trace observation point 이벤트 (eBPF 관측). 같은 패킷이 primary verdict와 별도로 잡힘'
      case 'TRANSLATED':
        return 'Cilium service translation 거침 (예: ClusterIP → backend pod IP NAT)'
      case 'REDIRECTED':
        return 'L7 proxy로 리다이렉트됨 (HTTP/DNS 정책 적용 시)'
      default:
        return ''
    }
  }

  return (
    <div className="hubble-panel hubble-detail-panel">
      <div className="hubble-panel-header">
        {activeNodeId ? (
          <button
            className="hubble-panel-title hubble-panel-back"
            onClick={onBack}
            title="연결 목록으로 돌아가기"
          >
            <span className="hubble-panel-back-arrow">‹</span>
            Connections
          </button>
        ) : (
          <h4 className="hubble-panel-title">Connection details</h4>
        )}
        <button className="hubble-panel-close" onClick={onClose} title="Close">
          ×
        </button>
      </div>
      <FancyScrollbar autoHide={true} className="hubble-detail-scroll">
      <div className="hubble-detail-scroll-content">
      <div className="hubble-detail-row">
        <span className="hubble-detail-key">From</span>
        <span className="hubble-detail-value" title={edge.src}>
          {edge.src}
        </span>
      </div>
      <div className="hubble-detail-row">
        <span className="hubble-detail-key">To</span>
        <span className="hubble-detail-value" title={edge.dst}>
          {edge.dst}
        </span>
      </div>
      <div
        className="hubble-detail-row"
        title="Hubble 관측 지점을 지난 flow '이벤트' 수 — 패킷/바이트/트래픽 양이 아닙니다."
      >
        <span className="hubble-detail-key">Flow events</span>
        <span className="hubble-detail-value">{edge.flowCount}</span>
      </div>
      {(edge.activeConns ?? 0) > 0 && (
        <div
          className="hubble-detail-row"
          title="윈도우 내 고유 5-tuple(src IP:port → dst IP:port, protocol) 수 — 실제 연결 수의 근사치. '+' 표시는 추적 상한 도달로 실제는 더 많음을 의미."
        >
          <span className="hubble-detail-key">Active conns</span>
          <span className="hubble-detail-value">
            {edge.activeConns.toLocaleString()}
            {edge.activeConnsCapped ? '+' : ''}
          </span>
        </div>
      )}
      {(edge.verdictCounts?.DROPPED ?? 0) > 0 && (
        <div className="hubble-detail-row hubble-detail-denied-summary">
          <span className="hubble-detail-key">Denied</span>
          <span className="hubble-detail-value hubble-verdict-dropped">
            {edge.verdictCounts.DROPPED}
          </span>
        </div>
      )}
      <div className="hubble-detail-section">
        <div className="hubble-detail-subtitle">Verdicts</div>
        {verdicts.length === 0 && (
          <div className="hubble-panel-empty">No verdict data</div>
        )}
        {verdicts.map(([name, count]) => {
          const isPrimary = primaryVerdicts.has(name)
          const rowClass = [
            'hubble-detail-row',
            'hubble-verdict-row',
            isPrimary ? '' : 'hubble-verdict-row--secondary',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div className={rowClass} key={name} title={verdictTooltip(name)}>
              <span className={`hubble-verdict-${name.toLowerCase()}`}>
                {name}
              </span>
              <span className="hubble-detail-value">{count}</span>
            </div>
          )
        })}
      </div>
      {(edge.topExternalIPs?.length ?? 0) > 0 && (
        <div className="hubble-detail-section">
          <div
            className="hubble-detail-subtitle"
            title="Unknown External 뒤에 숨은 실제 외부 IP 상위 목록. DNS visibility(L7 정책)를 켜면 FQDN 노드로 분해되어 이 목록 대신 도메인 이름으로 표시됩니다."
          >
            External peers (top IPs)
          </div>
          {edge.topExternalIPs!.map((ip, i) => (
            <div className="hubble-detail-row" key={i}>
              <span className="hubble-detail-l7-name" title={ip.name}>
                {ip.name || '—'}
              </span>
              <span className="hubble-detail-value">{ip.count}</span>
            </div>
          ))}
        </div>
      )}
      {(edge.l7Metrics?.length ?? 0) > 0 && (
        <div className="hubble-detail-section">
          <div
            className="hubble-detail-subtitle"
            title="L7 프로토콜별 요청 빈도와 응답 지연시간 (Hubble flow의 latency 필드 기반). 지연시간은 응답 레코드가 있는 요청에서만 집계됩니다."
          >
            L7 performance
          </div>
          {edge.l7Metrics!.map(m => (
            <div className="hubble-detail-row" key={m.type}>
              <span>{m.type}</span>
              <span className="hubble-detail-value">
                {formatL7Rate(m.count, snapshot)}
                {m.avgLatencyMs ? ` · avg ${m.avgLatencyMs}ms` : ''}
                {m.maxLatencyMs ? ` · max ${m.maxLatencyMs}ms` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      {(edge.topL7Denied?.length ?? 0) > 0 && (
        <div className="hubble-detail-section hubble-detail-section--denied">
          <div
            className="hubble-detail-subtitle hubble-detail-subtitle--denied"
            title="DROPPED verdict로 분류된 flow 중 L7 정보가 있던 시그니처. HTTP/DNS/Kafka 단위로 무엇이 차단됐는지 확인."
          >
            Denied L7 (what was blocked)
          </div>
          {edge.topL7Denied!.map((l, i) => (
            <div className="hubble-detail-row hubble-detail-l7-row" key={i}>
              <span className="hubble-detail-l7-name" title={l.name}>
                {l.name || '—'}
              </span>
              <span className="hubble-detail-value hubble-verdict-dropped">
                {l.count}
              </span>
            </div>
          ))}
          {(edge.topL7Policies?.length ?? 0) > 0 && (
            <>
              <div
                className="hubble-detail-l7-policy-hint"
                title="L7 차단은 deny 규칙 매칭이 아니라 '허용 목록에 없는 호출'이라서 Cilium이 차단 정책을 지목하지 않습니다. 아래는 이 연결의 L7 트래픽을 통제한 허용 목록 정책 — 위 호출들을 거부한 주체입니다. 클릭하면 허용 목록(spec)을 확인할 수 있습니다. (숫자는 이 정책이 L7 트래픽을 통제한 횟수)"
              >
                Blocked by allowlist policy
              </div>
              {edge.topL7Policies!.map((p, i) => (
                <PolicyRow key={i} policy={p} onClick={setSelectedPolicy} denied />
              ))}
            </>
          )}
        </div>
      )}
      {(edge.topDenyReasons?.length ?? 0) > 0 && (
        <div className="hubble-detail-section">
          <div
            className="hubble-detail-subtitle"
            title="Cilium datapath이 분류한 차단 사유 코드 (POLICY_DENIED, CT_INVALID 등). 운영자가 정책 vs 다른 원인을 구분할 때 사용."
          >
            Top deny reasons
          </div>
          {edge.topDenyReasons!.map((r, i) => (
            <div className="hubble-detail-row" key={i}>
              <span>{r.reason || r.name || '—'}</span>
              <span className="hubble-detail-value">{r.count}</span>
            </div>
          ))}
        </div>
      )}
      {(edge.topDeniedPolicies?.length ?? 0) > 0 && (
        <div className="hubble-detail-section hubble-detail-section--denied">
          <div
            className="hubble-detail-subtitle hubble-detail-subtitle--denied"
            title="이 연결에서 트래픽을 차단한 CiliumNetworkPolicy / NetworkPolicy. 클릭하면 정책 spec(YAML/JSON)을 모달로 확인."
          >
            Denied by policies
          </div>
          {edge.topDeniedPolicies!.map((p, i) => (
            <PolicyRow key={i} policy={p} onClick={setSelectedPolicy} denied />
          ))}
        </div>
      )}
      {(edge.topAllowedPolicies?.length ?? 0) > 0 && (
        <div className="hubble-detail-section">
          <div
            className="hubble-detail-subtitle"
            title="이 연결의 트래픽을 허용한 정책. 클릭하면 정책 spec을 모달로 확인."
          >
            Allowed by policies
          </div>
          {edge.topAllowedPolicies!.map((p, i) => (
            <PolicyRow key={i} policy={p} onClick={setSelectedPolicy} />
          ))}
        </div>
      )}
      {(edge.topL7?.length ?? 0) > 0 && (
        <div className="hubble-detail-section">
          <div
            className="hubble-detail-subtitle"
            title="HTTP method/path/status, DNS query, Kafka topic 등 L7 단위 시그니처. flow에 L7 정보가 있을 때만 집계."
          >
            Top L7
          </div>
          {edge.topL7!.map((l, i) => (
            <div className="hubble-detail-row hubble-detail-l7-row" key={i}>
              <span className="hubble-detail-l7-name" title={l.name}>
                {l.name || '—'}
              </span>
              <span className="hubble-detail-value">{l.count}</span>
            </div>
          ))}
        </div>
      )}
      <RecentFlowsSection
        flows={recentFlows}
        loading={flowsLoading}
        error={flowsError}
        onSelect={setDetailFlow}
      />
      </div>
      </FancyScrollbar>
      <FlowDetailsModal
        flow={detailFlow}
        cluster={cluster}
        onClose={() => setDetailFlow(null)}
      />
      <PolicyModal
        cluster={cluster}
        policy={selectedPolicy}
        onClose={() => setSelectedPolicy(null)}
      />
    </div>
  )
}

const EdgeListView: React.FC<{
  snapshot: HubbleSnapshot | null
  activeNodeId: string
  onSelectEdge: (edgeId: string, src: string, dst: string) => void
  onClose: () => void
  srcSearch: string
  dstSearch: string
  onSrcSearchChange: (value: string) => void
  onDstSearchChange: (value: string) => void
  onAiInspect: (edge: HubbleEdge) => void
}> = ({
  snapshot,
  activeNodeId,
  onSelectEdge,
  onClose,
  srcSearch,
  dstSearch,
  onSrcSearchChange,
  onDstSearchChange,
  onAiInspect,
}) => {
  const activeNode = snapshot?.nodes.find(n => n.id === activeNodeId) ?? null
  const activeNodeLabel = activeNode
    ? activeNode.name || activeNode.label || shortNodeId(activeNodeId)
    : shortNodeId(activeNodeId)

  const allEdges = (snapshot?.edges ?? [])
    .filter(e => e.src === activeNodeId || e.dst === activeNodeId)
    .slice()
    .sort((a, b) => b.flowCount - a.flowCount)

  const srcQuery = srcSearch.trim().toLowerCase()
  const dstQuery = dstSearch.trim().toLowerCase()
  const hasQuery = !!srcQuery || !!dstQuery
  const edges = hasQuery
    ? allEdges.filter(
        e =>
          (!srcQuery || shortNodeId(e.src).toLowerCase().includes(srcQuery)) &&
          (!dstQuery || shortNodeId(e.dst).toLowerCase().includes(dstQuery))
      )
    : allEdges

  return (
    <div className="hubble-panel hubble-detail-panel">
      <div className="hubble-panel-header">
        <h4 className="hubble-panel-title">
          Connection details
          <span className="hubble-panel-subtitle">{activeNodeLabel}</span>
        </h4>
        <button className="hubble-panel-close" onClick={onClose} title="Close">
          ×
        </button>
      </div>
      <div className="hubble-edge-list-search">
        <input
          className="hubble-flow-filter-input"
          value={srcSearch}
          onChange={e => onSrcSearchChange(e.target.value)}
          placeholder="Source"
          aria-label="Filter connections by source"
        />
        <input
          className="hubble-flow-filter-input"
          value={dstSearch}
          onChange={e => onDstSearchChange(e.target.value)}
          placeholder="Destination"
          aria-label="Filter connections by destination"
        />
      </div>
      <FancyScrollbar autoHide={true} className="hubble-detail-scroll">
        <div className="hubble-detail-scroll-content">
          {edges.length === 0 && (
            <div className="hubble-panel-empty">
              {hasQuery
                ? 'No connections match this filter'
                : 'No connections for this node in the current window'}
            </div>
          )}
          <ul className="hubble-top-talkers-list">
            {edges.map(e => {
              const denied = e.verdictCounts?.DROPPED ?? 0
              const id = edgeId(e.src, e.dst)
              const srcKind = nodeKindLabel(e.src)
              const dstKind = nodeKindLabel(e.dst)
              return (
                <li
                  className="hubble-top-talkers-row hubble-edge-list-row"
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectEdge(id, e.src, e.dst)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      onSelectEdge(id, e.src, e.dst)
                    }
                  }}
                >
                  <span className="hubble-edge-label">
                    <span className="hubble-edge-src">
                      <span className="hubble-edge-name">
                        {shortNodeId(e.src)}
                      </span>
                      {srcKind && (
                        <span className="hubble-edge-kind">{srcKind}</span>
                      )}
                    </span>
                    <span className="hubble-edge-arrow">→</span>
                    <span className="hubble-edge-dst">
                      <span className="hubble-edge-name">
                        {shortNodeId(e.dst)}
                      </span>
                      {dstKind && (
                        <span className="hubble-edge-kind">{dstKind}</span>
                      )}
                    </span>
                  </span>
                  <span className="hubble-edge-list-counts">
                    <strong>{e.flowCount.toLocaleString()}</strong>
                    {denied > 0 && (
                      <span className="hubble-verdict-dropped">
                        {' '}
                        ({denied.toLocaleString()} denied)
                      </span>
                    )}
                  </span>
                  {denied > 0 && (
                    <button
                      className="hubble-edge-inspect icon ai-robot"
                      title="이 연결을 AI에게 점검 요청"
                      aria-label={`Inspect ${shortNodeId(
                        e.src
                      )} to ${shortNodeId(e.dst)} with AI`}
                      onClick={ev => {
                        // The row itself opens edge details; keep the two
                        // actions from firing together.
                        ev.stopPropagation()
                        onAiInspect(e)
                      }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </FancyScrollbar>
    </div>
  )
}

const PolicyRow: React.FC<{
  policy: HubblePolicyRefCount
  onClick: (p: HubblePolicyRef) => void
  denied?: boolean
}> = ({policy, onClick, denied}) => {
  const label = policy.namespace
    ? `${policy.namespace}/${policy.name}`
    : policy.name
  return (
    <div
      className="hubble-detail-row hubble-policy-row"
      role="button"
      tabIndex={0}
      onClick={() => onClick(policy)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(policy)
        }
      }}
      title={`${policy.kind || 'Unknown'} — 클릭해서 spec 보기`}
    >
      <span className="hubble-policy-row-name">
        {policy.kind && (
          <span className="hubble-policy-kind-chip">{policyKindShort(policy.kind)}</span>
        )}
        {label || '—'}
      </span>
      <span
        className={
          denied
            ? 'hubble-detail-value hubble-verdict-dropped'
            : 'hubble-detail-value'
        }
      >
        {policy.count}
      </span>
    </div>
  )
}

// formatL7Rate renders request frequency as req/s over the snapshot window.
// Falls back to a raw count when the window duration is unknown.
const formatL7Rate = (
  count: number,
  snapshot: HubbleSnapshot | null
): string => {
  const start = snapshot?.window?.start ? Date.parse(snapshot.window.start) : NaN
  const end = snapshot?.window?.end ? Date.parse(snapshot.window.end) : NaN
  const seconds = (end - start) / 1000
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return `${count.toLocaleString()} req`
  }
  const rate = count / seconds
  return `${rate >= 10 ? Math.round(rate) : rate.toFixed(1)} req/s`
}

const policyKindShort = (kind: string): string => {
  switch (kind) {
    case 'CiliumNetworkPolicy':
      return 'CNP'
    case 'CiliumClusterwideNetworkPolicy':
      return 'CCNP'
    case 'NetworkPolicy':
      return 'NP'
    default:
      return kind
  }
}

const formatFlowTime = (iso: string): string => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t) || t <= 0) return '—'
  const ageMs = Date.now() - t
  if (ageMs < 0) return 'now'
  const sec = Math.floor(ageMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

const endpointLabel = (
  workload: string | undefined,
  pod: string | undefined,
  ip: string | undefined,
  port: number | undefined
): string => {
  const name = workload || pod || ip || '—'
  return port ? `${name}:${port}` : name
}

const verdictClass = (verdict: string): string => {
  switch (verdict) {
    case 'FORWARDED':
      return 'hubble-verdict-forwarded'
    case 'DROPPED':
      return 'hubble-verdict-dropped'
    case 'ERROR':
    case 'AUDIT':
      return 'hubble-verdict-error'
    default:
      return ''
  }
}

const RecentFlowsSection: React.FC<{
  flows: HubbleFlowRecord[]
  loading: boolean
  error: string
  onSelect: (flow: HubbleFlowRecord) => void
}> = ({flows, loading, error, onSelect}) => (
  <div className="hubble-detail-section">
    <div
      className="hubble-detail-subtitle"
      title="이 연결의 최근 raw flow 이벤트 (1초마다 갱신). 한 줄 클릭하면 Hubble UI 수준의 전체 디테일 (identity, labels, TCP flags, IP, 포트 등) 표시."
    >
      Recent flows{loading && flows.length === 0 ? ' (loading…)' : ''}
    </div>
    {error && (
      <div className="hubble-detail-row hubble-detail-flows-error">
        {error}
      </div>
    )}
    {!error && flows.length === 0 && !loading && (
      <div className="hubble-panel-empty">
        최근 수신한 flow가 없습니다 (LRU에서 evict됐거나 트래픽이 끊긴 상태)
      </div>
    )}
    {flows.map((f, i) => (
      <div
        className="hubble-flow-row hubble-flow-row--clickable"
        key={i}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(f)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(f)
          }
        }}
        title="클릭해서 전체 디테일 보기"
      >
        <div className="hubble-flow-row-line">
          <span className="hubble-flow-time">{formatFlowTime(f.time)}</span>
          <span className={`hubble-flow-verdict ${verdictClass(f.verdict)}`}>
            {f.verdict}
          </span>
          {f.protocol && (
            <span className="hubble-flow-proto">{f.protocol}</span>
          )}
        </div>
        <div className="hubble-flow-row-line hubble-flow-endpoints">
          <span title={`src: ${f.srcIp || '?'} ns=${f.srcNamespace || '?'}`}>
            {endpointLabel(f.srcWorkload, f.srcPod, f.srcIp, f.srcPort)}
          </span>
          <span className="hubble-flow-arrow">→</span>
          <span title={`dst: ${f.dstIp || '?'} ns=${f.dstNamespace || '?'}`}>
            {endpointLabel(f.dstWorkload, f.dstPod, f.dstIp, f.dstPort)}
          </span>
        </div>
        {(f.l7 || f.dropReason) && (
          <div className="hubble-flow-row-line hubble-flow-meta">
            {f.l7 && <span className="hubble-flow-l7">{f.l7}</span>}
            {f.dropReason && (
              <span className="hubble-flow-reason hubble-verdict-dropped">
                {f.dropReason}
              </span>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
)

const findEdge = (
  snapshot: HubbleSnapshot | null,
  edgeId: string | null
): HubbleEdge | null => {
  if (!snapshot || !edgeId) return null
  const sep = edgeId.indexOf('|')
  if (sep < 0) return null
  const src = edgeId.slice(0, sep)
  const dst = edgeId.slice(sep + 1)
  return snapshot.edges.find(e => e.src === src && e.dst === dst) ?? null
}

export default DetailPanel
