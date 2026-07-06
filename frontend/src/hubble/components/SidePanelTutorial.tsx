import React, {useState} from 'react'
import HubbleNodeCard from 'src/hubble/components/HubbleNodeCard'
import {cardHeightForNode} from 'src/hubble/utils/cardLayout'
import {NodeTrafficStats} from 'src/hubble/utils/nodeStats'
import {HubbleNode} from 'src/hubble/types'

// SidePanelTutorial is a step-by-step guide for the side panel tabs, opened
// from the "?" button in the tab strip. Each step renders a mock section
// (styled with the same classes as the real panels, so it looks identical)
// plus a plain-language explanation. The Nodes guide goes further and renders
// the real HubbleNodeCard component with mock data, so the example is
// pixel-identical to the live map. Self-contained: no network, no store.

export type TutorialTab =
  | 'header'
  | 'nodes'
  | 'talkers'
  | 'policy'
  | 'pods'
  | 'edge'

interface Props {
  initialTab: TutorialTab
  // Which guides this modal offers. Each "?" button passes only the guides
  // for its own screen area so the tab strip doesn't mix contexts. A single
  // entry hides the strip entirely.
  tabs?: TutorialTab[]
  onClose: () => void
}

interface TutorialStep {
  title: string
  description: string
  render: () => JSX.Element
}

const Row: React.FC<{
  label: string
  value: React.ReactNode
  valueClass?: string
}> = ({label, value, valueClass}) => (
  <div className="hubble-detail-row">
    <span className="hubble-detail-key">{label}</span>
    <span className={`hubble-detail-value ${valueClass || ''}`}>{value}</span>
  </div>
)

const EDGE_STEPS: TutorialStep[] = [
  {
    title: 'Edge details — 연결 요약',
    description:
      '맵에서 연결(엣지)을 클릭하면 이 탭이 열립니다. From/To는 통신 양 끝의 노드이고, Flow events는 Hubble이 관측한 이벤트 수(패킷/바이트 양이 아님), Active conns는 고유 5-tuple 기준 실제 연결 수의 근사치, Denied는 정책에 의해 차단된 이벤트 수입니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">Edge details</div>
        <Row label="From" value="ns:beyla-trace-demo" />
        <Row label="To" value="ns:ai-agent-poc" />
        <Row label="Flow events" value="96" />
        <Row label="Active conns" value="10" />
        <Row label="Denied" value="75" valueClass="hubble-verdict-dropped" />
      </div>
    ),
  },
  {
    title: 'Verdicts — 처리 결과별 집계',
    description:
      'Cilium이 각 flow를 어떻게 처리했는지의 분포입니다. FORWARDED=허용 후 전달, DROPPED=정책 차단, ERROR/AUDIT=오류·감사 모드. 회색의 TRACED/TRANSLATED/REDIRECTED는 같은 패킷의 커널 관측 이벤트라 참고용입니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">Verdicts</div>
        <Row label="DROPPED" value="75" valueClass="hubble-verdict-dropped" />
        <Row
          label="FORWARDED"
          value="21"
          valueClass="hubble-verdict-forwarded"
        />
        <div className="hubble-detail-row hubble-verdict-row--secondary">
          <span>TRANSLATED</span>
          <span className="hubble-detail-value">4</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Top deny reasons — 차단 사유',
    description:
      'Cilium datapath가 분류한 차단 사유 코드 상위 목록입니다. POLICY_DENIED는 네트워크 정책 차단, CT_INVALID 등은 다른 원인을 뜻합니다. "정책 때문인지 아닌지"를 가장 빨리 구분하는 지표입니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">Top deny reasons</div>
        <Row label="POLICY_DENIED" value="75" />
      </div>
    ),
  },
  {
    title: 'Denied / Allowed by policies — 원인 정책',
    description:
      '이 연결을 실제로 차단(또는 허용)한 CiliumNetworkPolicy / NetworkPolicy 목록입니다. 항목을 클릭하면 정책 YAML 원문이 모달로 열려 "어느 정책의 어떤 규칙 때문인지"까지 바로 확인할 수 있습니다 — 공식 Hubble UI에는 없는 기능입니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle hubble-detail-subtitle--denied">
          Denied by policies
        </div>
        <div className="hubble-detail-row hubble-policy-row">
          <span className="hubble-policy-row-name">
            <span className="hubble-policy-kind-chip">CNP</span>
            ai-agent-poc/hubble-demo-deny
          </span>
          <span className="hubble-detail-value hubble-verdict-dropped">75</span>
        </div>
      </div>
    ),
  },
  {
    title: 'L7 performance · External peers',
    description:
      'L7 정책(HTTP/DNS/Kafka)이 걸린 경로에서는 요청 빈도(req/s)와 응답 지연시간(avg/max)이 집계됩니다. 상대가 Unknown External이면 그 뒤에 숨은 실제 외부 IP 상위 목록도 여기서 확인합니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">L7 performance</div>
        <Row label="HTTP" value="12.4 req/s · avg 6ms · max 48ms" />
        <div className="hubble-detail-subtitle">External peers (top IPs)</div>
        <Row label="203.0.113.9" value="1,204" />
        <Row label="198.51.100.7" value="311" />
      </div>
    ),
  },
  {
    title: 'Recent flows — 최근 원본 flow',
    description:
      '이 연결의 최근 raw flow 20건이 실시간으로 흐릅니다. 한 행을 클릭하면 타임스탬프·IP·포트·TCP 플래그·drop reason까지 포함한 Flow Details 모달이 열립니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">Recent flows</div>
        <Row
          label="0s ago"
          value="route:42430 → otel-collector:4318"
          valueClass="hubble-verdict-forwarded"
        />
        <Row
          label="2s ago"
          value="route:42430 → otel-collector:4318"
          valueClass="hubble-verdict-dropped"
        />
      </div>
    ),
  },
]

const HEADER_STEPS: TutorialStep[] = [
  {
    title: '연결 상태 — 데이터를 믿어도 되는가',
    description:
      'Relay connected는 클러스터의 Hubble Relay(gRPC)와의 연결, Live는 이 화면으로의 실시간 푸시(WebSocket) 상태입니다. 둘 중 하나라도 빨간색이면 지금 보이는 맵이 최신이 아닐 수 있다는 뜻입니다.',
    render: () => (
      <div className="hubble-status-bar">
        <span className="hubble-status-pill is-ok">
          <span className="hubble-status-dot" />
          Relay connected
        </span>
        <span className="hubble-status-pill is-ok">
          <span className="hubble-status-dot" />
          Live
        </span>
      </div>
    ),
  },
  {
    title: 'Window · Flow events · Edges · Last flow',
    description:
      'Window는 관측 구간(기본 5분)과 채움 비율 — 이 구간에 트래픽이 없던 워크로드는 맵에 나타나지 않습니다. Flow events는 수신한 관측 이벤트 누적 수(트래픽 양 아님), Edges는 추적 중인 연결 수(cap hit 시 경고), Last flow는 마지막 수신 경과 시간으로 30초 이상이면 노란색 경고가 됩니다.',
    render: () => (
      <div className="hubble-status-bar">
        <span className="hubble-status-item">
          Window <strong>100%</strong> · 5m
        </span>
        <span className="hubble-status-item">
          Flow events <strong>2,003,207</strong>
        </span>
        <span className="hubble-status-item">
          Edges <strong>101</strong>
        </span>
        <span className="hubble-status-item">
          Last flow <strong>just now</strong>
        </span>
      </div>
    ),
  },
  {
    title: 'Verdict 필터 — All / Denied / Allowed',
    description:
      'Denied를 누르면 차단(DROPPED) flow가 있는 연결만, Allowed는 차단이 전혀 없는 연결만 남습니다. 필터 후 연결이 없는 카드는 자동으로 숨겨져 "차단 지점만 보기"가 한 클릭으로 됩니다.',
    render: () => (
      <div className="hubble-verdict-filter">
        <button type="button" className="hubble-verdict-filter-btn is-active">
          All
        </button>
        <button
          type="button"
          className="hubble-verdict-filter-btn hubble-verdict-filter-btn--denied"
        >
          Denied
        </button>
        <button type="button" className="hubble-verdict-filter-btn">
          Allowed
        </button>
      </div>
    ),
  },
  {
    title: '뷰 옵션 — Top connections · system · noise filters',
    description:
      'Top connections는 이벤트 수 상위 20개 연결만 그려 복잡한 맵을 정돈합니다(숨긴 수는 맵 좌상단에 표시). Hide system NS는 시스템 네임스페이스를 감추고, Noise filters는 DNS·host/node·monitoring 노드와 연결선을 토폴로지에서만 숨깁니다. 원본 Flow Table은 유지됩니다. 드릴다운 중에는 Cross-NS(Show/Dim/Group) 옵션이 추가됩니다.',
    render: () => (
      <div>
        <Row label="☑ Top connections" value="상위 20개만 표시" />
        <Row label="☑ Hide system NS" value="kube-* 숨김" />
        <Row label="Cross-NS (드릴다운)" value="Show / Dim / Group" />
      </div>
    ),
  },
  {
    title: '맵 조작 — Fit · Center · Reset layout',
    description:
      '빈 공간 드래그로 이동, 휠로 확대/축소, 카드 왼쪽 그립을 잡으면 카드 개별 이동이 됩니다. Fit은 전체를 화면에 맞추고, Reset layout은 손으로 옮긴 카드까지 초기 배치로 되돌립니다. 하단 Flow table 토글(▼/▲)로 원본 flow 표를 접거나 펼칩니다.',
    render: () => (
      <div>
        <Row label="빈 공간 드래그 / 휠" value="이동 / 확대·축소" />
        <Row label="Fit · Center" value="화면 맞춤 · 중앙 정렬" />
        <Row label="Reset layout" value="카드 배치 초기화" />
        <Row label="▼ Flow table" value="하단 flow 표 접기/펼치기" />
      </div>
    ),
  },
]

// ---------- Nodes guide: real cards + edges rendered with mock data ----------

const mockStats = (over: Partial<NodeTrafficStats> = {}): NodeTrafficStats => ({
  inFlows: 8751,
  outFlows: 5013,
  internalFlows: 0,
  deniedFlows: 0,
  ingressDeniedFlows: 0,
  egressDeniedFlows: 0,
  ingressDenied: false,
  egressDenied: false,
  hadRecentDeny: false,
  ...over,
})

const MockCard: React.FC<{
  node: HubbleNode
  stats: NodeTrafficStats
  x?: number
  y?: number
}> = ({node, stats, x = 12, y = 10}) => (
  <HubbleNodeCard
    node={node}
    stats={stats}
    shareDisplay={{mode: 'none', inShare: null, outShare: null}}
    windowLabel="5m"
    x={x}
    y={y}
    height={cardHeightForNode(node, stats)}
    isSelected={false}
    isNeighbor={false}
    isDimmed={false}
    isFocusNs={false}
    isCrossNs={false}
    showDrillAction={false}
  />
)

const nsNode = (
  name: string,
  inPort?: string,
  outPort?: string
): HubbleNode => ({
  id: `ns:${name}`,
  kind: 'namespace',
  name,
  ...(inPort ? {topInPorts: [{name: inPort, count: 8751}]} : {}),
  ...(outPort ? {topOutPorts: [{name: outPort, count: 3120}]} : {}),
})

const NODES_STEPS: TutorialStep[] = [
  {
    title: '카드 구성 — 노드 한 장 읽기',
    description:
      '맵의 카드 하나가 노드 하나입니다. 좌상단 종류(NAMESPACE/WORKLOAD/EXTERNAL/NS GROUP), 이름, 포트, In/Out 이벤트 수 순으로 읽습니다. 포트는 방향이 구분됩니다 — ⬇(파랑)은 이 노드가 수신(서비스)하는 포트, ⬆(보라)은 이 노드가 나가서 접속하는 상대 포트입니다. 왼쪽 점무늬 그립을 잡으면 카드를 옮길 수 있습니다.',
    render: () => (
      <div className="hubble-tutorial-map" style={{height: 178}}>
        <MockCard
          node={nsNode('ai-agent-poc', '4318 TCP', '5432 TCP')}
          stats={mockStats()}
        />
      </div>
    ),
  },
  {
    title: 'In / Out — 유입·유출 이벤트',
    description:
      '현재 윈도우(기본 5분)에서 이 노드로 들어오고(In) 나간(Out) flow 이벤트 수입니다 — 패킷/바이트 양이 아닙니다. 카드를 클릭해 선택하면 이웃 카드에 %가 나타나는데, 이는 선택한 노드와의 연결 기여도를 뜻합니다.',
    render: () => (
      <div className="hubble-tutorial-map" style={{height: 156}}>
        <MockCard
          node={nsNode('cloudhub', '2380 TCP')}
          stats={mockStats({inFlows: 6899, outFlows: 6539})}
        />
      </div>
    ),
  },
  {
    title: '차단 신호 — Dropped vs ⚠ recovered',
    description:
      '왼쪽 카드처럼 빨간 "DROPPED n" 뱃지 + 하단 Ingress/Egress drop 줄은 차단이 진행 중이라는 뜻입니다. 오른쪽 카드의 노란 "⚠ recovered"는 최근 5분 안에 drop이 있었지만 지금(최근 10초)은 정상이라는 이력 신호입니다.',
    render: () => (
      <div className="hubble-tutorial-map" style={{height: 190}}>
        <MockCard
          node={nsNode('ai-agent-poc', '4318 TCP')}
          stats={mockStats({
            deniedFlows: 214,
            ingressDeniedFlows: 214,
            ingressDenied: true,
            hadRecentDeny: true,
          })}
        />
        <MockCard
          x={300}
          node={nsNode('beyla-trace-demo', '53 UDP')}
          stats={mockStats({hadRecentDeny: true})}
        />
      </div>
    ),
  },
  {
    title: 'External 카드 — 외부 대상',
    description:
      '클러스터 밖 대상은 EXTERNAL 카드로 묶입니다. DNS로 식별되면 도메인 이름(FQDN) 카드로, 아니면 "Unknown External" 하나로 집계되며 이때 실제 외부 IP 상위 3개가 카드에 미리 표시됩니다. 연결을 클릭하면 Edge 탭에서 top 5까지 확인됩니다.',
    render: () => (
      <div className="hubble-tutorial-map" style={{height: 210}}>
        <MockCard
          node={{
            id: 'ext:unknown',
            kind: 'external',
            label: 'Unknown External',
            topInPorts: [{name: '53 UDP', count: 21651}],
            topExternalIPs: [
              {name: '203.0.113.9', count: 1204},
              {name: '198.51.100.7', count: 311},
            ],
          }}
          stats={mockStats({inFlows: 21651, outFlows: 38246})}
        />
      </div>
    ),
  },
  {
    title: '엣지(연결선) 읽는 법',
    description:
      '선 두께는 이벤트 수(로그 스케일)입니다. 초록 실선은 정상, 빨간 점선은 차단(denied) 포함, 선 가운데 ⚠는 최근 drop 후 회복을 뜻합니다. 선을 클릭하면 우측 Edge 탭에 verdict·정책·최근 flow 상세가 열리고, namespace 카드를 선택하면 "Open namespace"로 드릴다운합니다.',
    render: () => (
      <div className="hubble-tutorial-map" style={{height: 190}}>
        <MockCard node={nsNode('web')} stats={mockStats()} y={26} />
        <MockCard x={328} node={nsNode('api')} stats={mockStats()} y={26} />
        <svg className="hubble-tutorial-edge-svg" width="100%" height="100%">
          <path
            d="M 188 60 C 240 60, 276 60, 328 60"
            fill="none"
            stroke="#4ed8a0"
            strokeWidth={4.5}
          />
          <path
            d="M 188 90 C 240 90, 276 90, 328 90"
            fill="none"
            stroke="#4ed8a0"
            strokeWidth={2}
          />
          <g transform="translate(258, 90)">
            <circle r={9} fill="#1c1c21" stroke="#ffb94a" strokeWidth={1.5} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffb94a"
              fontSize={11}
              fontWeight={700}
            >
              ⚠
            </text>
          </g>
          <path
            d="M 188 120 C 240 120, 276 120, 328 120"
            fill="none"
            stroke="#ff6f6f"
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
          <text x={240} y={50} fill="#8e91a1" fontSize={9}>
            정상 (굵기=이벤트 수)
          </text>
          <text x={276} y={94} fill="#8e91a1" fontSize={9}>
            회복
          </text>
          <text x={240} y={134} fill="#8e91a1" fontSize={9}>
            차단 포함
          </text>
        </svg>
      </div>
    ),
  },
]

const TALKERS_STEPS: TutorialStep[] = [
  {
    title: 'Top Talkers — 통신량 상위 연결',
    description:
      '현재 관측 윈도우(기본 5분)에서 flow 이벤트가 가장 많은 src → dst 쌍의 순위입니다. 클러스터에서 "지금 누가 제일 시끄러운가"를 한눈에 봅니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">Top Talkers</div>
        <Row label="longhorn-system → longhorn-system" value="118,351" />
        <Row label="cloudhub → cloudhub" value="13,920" />
        <Row label="Unknown External → cloudhub" value="3,741" />
      </div>
    ),
  },
  {
    title: '해석 주의 — 이벤트 수 기준',
    description:
      '순위는 트래픽 양(bytes)이 아니라 flow 이벤트 수 기준입니다. DNS처럼 자잘하고 빈번한 통신이 위로 올라오고, 대용량 파일 전송(긴 커넥션 하나)은 아래에 있을 수 있습니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">예시</div>
        <Row label="DNS 53/UDP (이벤트 多)" value="상위 노출 ↑" />
        <Row label="대용량 전송 (커넥션 1개)" value="하위 노출 ↓" />
      </div>
    ),
  },
]

const POLICY_STEPS: TutorialStep[] = [
  {
    title: 'Policy impact — baseline 캡처',
    description:
      'NetworkPolicy를 적용하기 전에 "Capture baseline"을 누르면 현재 flow 목록(누가 누구와 통신하는지)이 저장됩니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">Policy impact</div>
        <Row label="Baseline" value="12:49:50 · 200 flows · 14 dependencies" />
      </div>
    ),
  },
  {
    title: '정책 적용 후 트래픽 재현',
    description:
      '정책을 적용하고 평소 트래픽이 다시 흐르게 한 뒤 이 탭으로 돌아옵니다. 현재 flow가 baseline과 자동으로 비교됩니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">비교 진행</div>
        <Row label="현재 수집" value="200 flows" />
      </div>
    ),
  },
  {
    title: '비교 결과 — 끊긴 의존성 찾기',
    description:
      'baseline에 있었지만 지금은 차단(또는 사라진) 통신이 의존성 단위로 표시됩니다. "정책을 넣었더니 뭐가 깨졌나"를 배포 직후 즉시 확인하는 용도입니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">결과 예시</div>
        <Row
          label="beyla → otel-collector:4318"
          value="BLOCKED"
          valueClass="hubble-verdict-dropped"
        />
        <Row
          label="web → api:8080"
          value="OK"
          valueClass="hubble-verdict-forwarded"
        />
      </div>
    ),
  },
]

const PODS_STEPS: TutorialStep[] = [
  {
    title: 'Pods — 파드 단위 연결 (드릴다운 전용)',
    description:
      'Namespace 카드에서 "Open namespace"로 드릴다운하면 나타나는 탭입니다. 그 namespace 안 pod 각각이 어디와 통신 중인지 하단 flow 스트림을 pod 단위로 요약합니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">Pod connections</div>
        <Row label="otel-collector-76db…" value="4 peers · 1,204 events" />
        <Row label="route-69f77cf64…" value="2 peers · 96 events" />
      </div>
    ),
  },
  {
    title: '활용 — 이상 파드 찾기',
    description:
      '같은 workload의 replica 중 하나만 통신 패턴이 다르거나 drop이 몰려 있으면 그 pod만 콕 집어낼 수 있습니다.',
    render: () => (
      <div>
        <div className="hubble-detail-subtitle">예시</div>
        <Row
          label="api-7d9f… (replica 3/3)"
          value="drop 82"
          valueClass="hubble-verdict-dropped"
        />
      </div>
    ),
  },
]

const TUTORIALS: Record<TutorialTab, {label: string; steps: TutorialStep[]}> = {
  header: {label: 'Header', steps: HEADER_STEPS},
  nodes: {label: 'Nodes', steps: NODES_STEPS},
  talkers: {label: 'Talkers', steps: TALKERS_STEPS},
  policy: {label: 'Policy', steps: POLICY_STEPS},
  pods: {label: 'Pods', steps: PODS_STEPS},
  edge: {label: 'Edge', steps: EDGE_STEPS},
}

const TAB_ORDER: TutorialTab[] = [
  'header',
  'nodes',
  'talkers',
  'policy',
  'pods',
  'edge',
]

const SidePanelTutorial: React.FC<Props> = ({initialTab, tabs, onClose}) => {
  const [tab, setTab] = useState<TutorialTab>(initialTab)
  const [step, setStep] = useState(0)

  const offeredTabs = tabs && tabs.length > 0 ? tabs : TAB_ORDER
  const {steps} = TUTORIALS[tab]
  const current = steps[Math.min(step, steps.length - 1)]

  const selectTab = (next: TutorialTab) => {
    setTab(next)
    setStep(0)
  }

  return (
    <div className="hubble-tutorial-backdrop" onClick={onClose}>
      <div
        className="hubble-tutorial-modal"
        role="dialog"
        aria-label="Side panel tutorial"
        onClick={e => e.stopPropagation()}
      >
        <div className="hubble-tutorial-header">
          <h3 className="hubble-tutorial-title">
            {TUTORIALS[tab].label} 탭 가이드
            <span className="hubble-tutorial-progress-label">
              {step + 1}/{steps.length}
            </span>
          </h3>
          <button
            type="button"
            className="hubble-tutorial-close"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
        {offeredTabs.length > 1 && (
          <div className="hubble-tutorial-tabs">
            {offeredTabs.map(t => (
              <button
                key={t}
                type="button"
                className={`hubble-tutorial-tab ${
                  t === tab ? 'is-active' : ''
                }`}
                onClick={() => selectTab(t)}
              >
                {TUTORIALS[t].label}
              </button>
            ))}
          </div>
        )}
        <div className="hubble-tutorial-body">
          <div className="hubble-tutorial-step-title">{current.title}</div>
          <div className="hubble-tutorial-mock" aria-label="Mock data example">
            <div className="hubble-tutorial-mock-badge">예시 데이터</div>
            {current.render()}
          </div>
          <div className="hubble-tutorial-desc">{current.description}</div>
        </div>
        <div className="hubble-tutorial-footer">
          <button
            type="button"
            className="hubble-tutorial-prev"
            disabled={step === 0}
            onClick={() => setStep(s => Math.max(0, s - 1))}
          >
            이전
          </button>
          <div className="hubble-tutorial-dots">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`hubble-tutorial-dot ${
                  i === step ? 'is-active' : ''
                }`}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
          {step < steps.length - 1 ? (
            <button
              type="button"
              className="hubble-tutorial-next"
              onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              className="hubble-tutorial-next"
              onClick={onClose}
            >
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SidePanelTutorial
