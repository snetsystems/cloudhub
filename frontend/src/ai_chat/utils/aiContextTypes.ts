import {registerAiContextType} from 'src/ai_chat/utils/aiContextRegistry'

/**
 * Context types CloudHub screens can attach.
 *
 * Imported once for its side effects (see src/ai_chat/containers/
 * CloudhubAiChatStandalone). Adding a screen means adding a registration
 * here — nothing inside AI Chat changes.
 */

export interface ServerContextPayload {
  name: string
  /** From the salt minion record, so absent for hosts without one. */
  ip?: string
  /** Alert level from the server list, e.g. 'danger'. Chip display only. */
  status?: string
  cpu?: number
  memory?: number
  disk?: number
  diskIo?: number
}

/**
 * Only identity reaches the agent — never the measurements.
 *
 * The agent queries InfluxDB itself, at full fidelity and over whatever range
 * the question needs. What the table shows is a rounded instant, captured when
 * the row was attached and then frozen while the page keeps auto-refreshing,
 * so sending it would hand the agent a staler, coarser version of something it
 * can read properly — and leave it with no way to tell which number to trust.
 *
 * The measurements stay on the chip, where they tell the user what they picked.
 *
 * The IP is left out too. CloudHub only learns it from a salt minion record, so
 * it is present for some hosts and missing for others — and a missing one reads
 * as "this host has no address" rather than "CloudHub has no record of one".
 * An agent that has to reason about which of those it is has been made worse
 * off, not better, so only the host name is sent.
 */
registerAiContextType<ServerContextPayload>('server', {
  label: '서버',
  toPromptText: host => host.name,
  defaultPrompt: host =>
    `${host.name} 서버의 현재 상태를 진단하고, 이상 징후가 있다면 원인과 조치 방법을 알려줘.`,
})

/** Free text a user selected on a page, quoted into the conversation. */
export interface TextContextPayload {
  text: string
}

registerAiContextType<TextContextPayload>('text', {
  label: '선택한 내용',
  toPromptText: ({text}) => text,
})

/** One endpoint of a Hubble connection, parsed from its map node id. */
export interface ConnectionEndpoint {
  /** The id with its prefix stripped, e.g. 'network-repair-demo/frontend'. */
  name: string
  /** 'workload' | 'ns' | 'ns group' | 'external'. */
  kind?: string
  /** Absent for external peers, which run outside the cluster. */
  namespace?: string
  /** Absent when the endpoint is a whole namespace rather than a workload. */
  workload?: string
}

export interface ConnectionContextPayload {
  source: ConnectionEndpoint
  destination: ConnectionEndpoint
  flowCount: number
  /** Every DROPPED flow on the edge, policy denials and infra drops alike. */
  denied: number
  policyDenied: number
  infraDropped: number
  denyReasons: Array<{name?: string; count: number}>
  deniedPolicies: Array<{
    name: string
    namespace?: string
    kind?: string
    count: number
  }>
}

const endpointText = (e: ConnectionEndpoint): string =>
  e.workload ? `${e.namespace}/${e.workload}` : e.name

const countList = (
  items: Array<{name?: string; count: number}>
): string | null => {
  const parts = items
    .filter(i => i.name)
    .map(i => `${i.name}(${i.count})`)
    .join(', ')

  return parts || null
}

/**
 * Unlike a server row, the counts here DO reach the agent.
 *
 * Hubble's flow record is the one thing the agent cannot read for itself: the
 * Kubernetes API says which policies exist, never which packets they dropped
 * or why. Handing over the verdict split and the denying policy names turns an
 * open-ended "inspect this namespace" into a question with a starting point.
 *
 * The policy/infrastructure split travels with the totals for the same reason
 * the map separates them: an IPv6 Router Solicitation dropped by the datapath
 * is not a NetworkPolicy problem, and an agent told only "10 dropped" would go
 * looking for a policy that was never involved.
 */
registerAiContextType<ConnectionContextPayload>('k8s-connection', {
  label: '연결',
  toPromptText: c => {
    const src = endpointText(c.source)
    const dst = endpointText(c.destination)
    const reasons = countList(c.denyReasons)
    const policies = countList(c.deniedPolicies)

    return [
      `Kubernetes 연결 ${src} → ${dst}`,
      c.source.namespace ? `출발 네임스페이스: ${c.source.namespace}` : null,
      c.destination.namespace
        ? `도착 네임스페이스: ${c.destination.namespace}`
        : null,
      `flow ${c.flowCount}건 중 ${c.denied}건 DROPPED ` +
        `(정책 차단 ${c.policyDenied}, 인프라 드롭 ${c.infraDropped})`,
      reasons ? `drop 사유: ${reasons}` : null,
      policies ? `차단한 정책: ${policies}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  },
  defaultPrompt: c =>
    `${endpointText(c.source)} → ${endpointText(
      c.destination
    )} 연결이 차단된 원인을 진단하고 복구해줘.`,
})
