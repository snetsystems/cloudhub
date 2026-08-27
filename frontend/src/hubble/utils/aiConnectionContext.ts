import {
  HubbleEdge,
  HubbleNamedCount,
  HubblePolicyRefCount,
} from 'src/hubble/types'
import {splitDrops} from 'src/hubble/utils/dropReasons'
import {
  ConnectionContextPayload,
  ConnectionEndpoint,
} from 'src/ai_chat/utils/aiContextTypes'

/**
 * Turn one Connections row into the capsule payload AI Chat attaches.
 *
 * The map's node ids carry the only identity the agent needs — `wl:ns/name`,
 * `ns:name`, `nsgrp:name`, `ext:name` — so the endpoints are parsed from them
 * rather than looked up in the snapshot.
 */

/** Kind label per node-id prefix, matching the map's node cards. */
const KINDS: Array<[string, string]> = [
  ['nsgrp:', 'ns group'],
  ['ns:', 'ns'],
  ['wl:', 'workload'],
  ['ext:', 'external'],
]

const parseEndpoint = (id: string): ConnectionEndpoint => {
  const entry = KINDS.find(([prefix]) => id.startsWith(prefix))
  const name = entry ? id.slice(entry[0].length) : id
  const kind = entry?.[1]

  // An external peer sits outside the cluster, so it has no namespace: naming
  // one would read as a claim about where it runs.
  if (kind === 'external') return {name, kind}

  const sep = name.indexOf('/')
  if (sep < 0) return {name, kind, namespace: name}

  return {
    name,
    kind,
    namespace: name.slice(0, sep),
    workload: name.slice(sep + 1),
  }
}

const named = (item: HubbleNamedCount): HubbleNamedCount => ({
  name: item.name || item.reason,
  count: item.count,
})

const policy = (p: HubblePolicyRefCount) => ({
  name: p.name,
  namespace: p.namespace,
  kind: p.kind,
  count: p.count,
})

/**
 * Skill suggested when a connection is attached from the Connections list.
 *
 * Seeded into the composer as editable text, so a user who wants something
 * other than a repair run can simply delete it.
 */
export const CONNECTION_ATTACH_SKILL = '/network-fault-drill'

/** Question sent with the skill when a connection is inspected. */
export const CONNECTION_DIAGNOSE_MESSAGE =
  'k8s_network 이 연결이 차단된 원인을 진단하고 복구해줘.'

export const buildConnectionContextPayload = (
  edge: HubbleEdge
): ConnectionContextPayload => {
  const denied = edge.verdictCounts?.DROPPED ?? 0
  const {policy: policyDenied, infra: infraDropped} = splitDrops(edge, denied)

  return {
    source: parseEndpoint(edge.src),
    destination: parseEndpoint(edge.dst),
    flowCount: edge.flowCount,
    denied,
    policyDenied,
    infraDropped,
    denyReasons: (edge.topDenyReasons || []).map(named),
    deniedPolicies: (edge.topDeniedPolicies || []).map(policy),
  }
}

/** One line of detail shown on the chip, not sent to the agent. */
export const buildConnectionContextSummary = (edge: HubbleEdge): string => {
  const denied = edge.verdictCounts?.DROPPED ?? 0
  return `${denied.toLocaleString()} denied / ${edge.flowCount.toLocaleString()} flows`
}
