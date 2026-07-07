// Mirrors backend/hubble/snapshot.go. Keep in sync if the JSON contract
// changes (snapshot Schema is shared between REST and WebSocket payloads).
//
// Hubble flow protobuf does not carry payload byte counts, so only flow-event
// counts are tracked. Use Prometheus / conntrack for byte-level metrics.

export interface HubbleSnapshot {
  kind: 'overview' | 'workload'
  clusterName: string
  forNamespace?: string
  snapshotAt: string
  window: HubbleSnapshotWindow
  status: HubbleSnapshotStatus
  nodes: HubbleNode[]
  edges: HubbleEdge[]
  topTalkers: HubbleTopTalker[]
}

export interface HubbleSnapshotWindow {
  start: string
  end: string
  filled: number
}

export interface HubbleSnapshotStatus {
  relayConnected: boolean
  lastFlowAt?: string
  flowsReceived: number
  edgesTracked: number
  edgeCapHit: boolean
  error?: string
}

export type HubbleNodeKind = 'namespace' | 'workload' | 'external'

export interface HubbleNode {
  id: string
  kind: HubbleNodeKind
  name?: string
  fqdn?: string
  label?: string
  system?: boolean
  namespace?: string
  // topInPorts: ports this node serves on (flow destination side).
  // topOutPorts: peer ports this node connects out to (flow source side).
  topInPorts?: HubbleNamedPort[]
  topOutPorts?: HubbleNamedPort[]
  labels?: string[]
  ingressOpen?: boolean
  egressOpen?: boolean
  ingressDenied?: boolean
  egressDenied?: boolean
  // Raw peer IPs aggregated into the "ext:unknown" node (preview, top 3).
  topExternalIPs?: HubbleNamedCount[]
  // Client-only marker. Set by groupExternalNamespaces when collapsing
  // multiple cross-namespace workloads into a single synthetic node during
  // drilldown. Backend never emits this.
  groupedKind?: 'namespace-group'
  groupedMemberCount?: number
}

export interface HubbleNamedPort {
  name: string
  count: number
}

export interface HubbleEdge {
  src: string
  dst: string
  flowCount: number
  verdictCounts: Record<string, number>
  recentVerdictCounts?: Record<string, number>
  lastVerdict?: string
  topDenyReasons?: HubbleNamedCount[]
  topAllowedPolicies?: HubblePolicyRefCount[]
  topDeniedPolicies?: HubblePolicyRefCount[]
  // Allow policies that governed proxied(L7) traffic on this edge = the L7
  // allowlist. L7 denials carry no deniedBy in Cilium, so these are the
  // policies whose allowlist rejected the calls listed in topL7Denied.
  topL7Policies?: HubblePolicyRefCount[]
  topL7?: HubbleNamedCount[]
  // DROPPED-verdict L7 signatures only — what specifically was blocked.
  topL7Denied?: HubbleNamedCount[]
  // Approximate distinct connections (5-tuples) in the window. When capped
  // is true the count is a lower bound (backend tracking cap was hit).
  activeConns?: number
  activeConnsCapped?: boolean
  l7Metrics?: HubbleL7Metric[]
  // Raw peer IPs behind an "ext:unknown" endpoint on this edge.
  topExternalIPs?: HubbleNamedCount[]
}

// Per-L7-protocol request volume and response latency for one edge.
export interface HubbleL7Metric {
  type: string
  count: number
  avgLatencyMs?: number
  maxLatencyMs?: number
}

export interface HubbleNamedCount {
  name?: string
  reason?: string
  count: number
}

// Cilium / Kubernetes network policy reference. `kind` is inferred from the
// Hubble policy proto's derived-from label and is used by the frontend to
// pick the right K8s API path (CiliumNetworkPolicy vs NetworkPolicy etc).
export interface HubblePolicyRef {
  name: string
  namespace?: string
  kind?: string
  labels?: string[]
  revision?: number
}

export interface HubblePolicyRefCount extends HubblePolicyRef {
  count: number
}

// Payload from /cloudhub/v1/hubble/clusters/:name/policy?kind=&namespace=&name=
export interface HubblePolicyResponse {
  kind: string
  namespace?: string
  name: string
  apiPath: string
  spec: unknown
}

export interface HubbleTopTalker {
  src: string
  dst: string
  flowCount: number
}

export interface HubbleClusterInfo {
  name: string
  relayConnected: boolean
}

export interface HubbleClustersResponse {
  clusters: HubbleClusterInfo[]
}

// Raw per-flow record. One entry = one Hubble flow event. Used by the
// "Recent flows" drawer in DetailPanel to show what actually happened on a
// given edge in the last few seconds.
export interface HubbleFlowRecord {
  time: string
  verdict: string
  trafficDirection?: string
  observationPoint?: string
  srcId: string
  dstId: string
  srcNamespace?: string
  dstNamespace?: string
  srcWorkload?: string
  dstWorkload?: string
  srcPod?: string
  dstPod?: string
  srcIdentity?: number
  dstIdentity?: number
  srcLabels?: string[]
  dstLabels?: string[]
  srcIp?: string
  dstIp?: string
  protocol?: string
  srcPort?: number
  dstPort?: number
  tcpFlags?: string[]
  l7?: string
  dropReason?: string
  allowedBy?: HubblePolicyRef[]
  deniedBy?: HubblePolicyRef[]
}

export interface HubbleEdgeFlowsResponse {
  flows: HubbleFlowRecord[]
}

export interface HubbleFlowFilters {
  srcWorkload?: string
  dstWorkload?: string
  srcNamespace?: string
  dstNamespace?: string
  verdict?: string
  dropReason?: string
  protocol?: string
  port?: string
  l7Type?: string
  l7Query?: string
  externalOnly?: boolean
  q?: string
}

export interface PolicyImpactContext {
  cluster: string
  namespace?: string
  filters?: HubbleFlowFilters
}

export interface PolicyImpactSummary {
  key: string
  srcNamespace: string
  srcWorkload: string
  srcLabel: string
  dstNamespace: string
  dstWorkload: string
  dstLabel: string
  port?: number
  protocol?: string
  l7?: string
  flowCount: number
  primaryVerdict: string
  verdicts: Record<string, number>
  dropReasons: Record<string, number>
}

export interface PolicyImpactBaseline {
  capturedAt: string
  context: PolicyImpactContext
  summaries: PolicyImpactSummary[]
  flowCount: number
}

export interface PolicyImpactEntry {
  key: string
  srcLabel: string
  dstLabel: string
  srcWorkload?: string
  dstWorkload?: string
  port?: number
  protocol?: string
  l7?: string
  beforeVerdict?: string
  afterVerdict?: string
  beforeCount: number
  afterCount: number
  dropReasons: Record<string, number>
}

export interface PolicyImpactComparison {
  contextMatches: boolean
  baselineCount: number
  currentCount: number
  newlyDenied: PolicyImpactEntry[]
  stillDenied: PolicyImpactEntry[]
  recovered: PolicyImpactEntry[]
  stillAllowed: PolicyImpactEntry[]
  newConnections: PolicyImpactEntry[]
  missingConnections: PolicyImpactEntry[]
}
