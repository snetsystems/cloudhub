// summarizePolicy parses a CiliumNetworkPolicy / CiliumClusterwideNetworkPolicy
// / NetworkPolicy spec JSON into a flat, operator-friendly view. The goal is
// to surface "what does this policy actually do?" without making the user
// read raw YAML — selector matchLabels, peers (endpoints/CIDR/FQDN/entity),
// ports, and L7 matchers are collapsed to short strings.

export interface PolicySummary {
  apiVersion?: string
  kind?: string
  description?: string
  appliesTo: string
  rules: PolicyRuleSummary[]
  unknown: boolean // true if we don't recognize the shape — caller falls back to JSON-only.
}

export interface PolicyRuleSummary {
  direction: 'Ingress' | 'Egress'
  action: 'Allow' | 'Deny'
  peers: string[]
  ports: string[]
  l7: string[]
}

type AnyObj = {[k: string]: any}

export const summarizePolicy = (raw: unknown): PolicySummary | null => {
  if (!raw || typeof raw !== 'object') return null
  const spec = (raw as AnyObj).spec
  const apiVersion = String((raw as AnyObj).apiVersion || '')
  const kind = String((raw as AnyObj).kind || '')

  if (!spec || typeof spec !== 'object') {
    return {
      apiVersion,
      kind,
      appliesTo: 'unknown',
      rules: [],
      unknown: true,
    }
  }

  if (apiVersion.startsWith('cilium.io/')) {
    return summarizeCilium(apiVersion, kind, spec)
  }
  if (apiVersion.startsWith('networking.k8s.io/')) {
    return summarizeK8sNetworkPolicy(apiVersion, kind, spec)
  }

  // Heuristic: Cilium policies have `endpointSelector`, K8s has `podSelector`.
  if ('endpointSelector' in spec || 'nodeSelector' in spec) {
    return summarizeCilium(apiVersion, kind, spec)
  }
  if ('podSelector' in spec) {
    return summarizeK8sNetworkPolicy(apiVersion, kind, spec)
  }

  return {
    apiVersion,
    kind,
    appliesTo: 'unknown',
    rules: [],
    unknown: true,
  }
}

const summarizeCilium = (
  apiVersion: string,
  kind: string,
  spec: AnyObj
): PolicySummary => {
  const appliesTo =
    selectorToString(spec.endpointSelector) ||
    selectorToString(spec.nodeSelector, 'node') ||
    'all endpoints'

  const rules: PolicyRuleSummary[] = []
  collectCiliumRules(rules, spec.ingress, 'Ingress', 'Allow')
  collectCiliumRules(rules, spec.ingressDeny, 'Ingress', 'Deny')
  collectCiliumRules(rules, spec.egress, 'Egress', 'Allow')
  collectCiliumRules(rules, spec.egressDeny, 'Egress', 'Deny')

  return {
    apiVersion,
    kind,
    description: typeof spec.description === 'string' ? spec.description : undefined,
    appliesTo,
    rules,
    unknown: false,
  }
}

const collectCiliumRules = (
  out: PolicyRuleSummary[],
  arr: any,
  direction: 'Ingress' | 'Egress',
  action: 'Allow' | 'Deny'
): void => {
  if (!Array.isArray(arr)) return
  for (const r of arr) {
    out.push({
      direction,
      action,
      peers: ciliumPeers(r, direction),
      ports: portsFromToPorts(r.toPorts),
      l7: l7FromToPorts(r.toPorts),
    })
  }
}

const ciliumPeers = (
  rule: AnyObj,
  direction: 'Ingress' | 'Egress'
): string[] => {
  const prefix = direction === 'Ingress' ? 'from' : 'to'
  const peers: string[] = []

  const endpoints = rule[`${prefix}Endpoints`]
  if (Array.isArray(endpoints)) {
    for (const sel of endpoints) {
      const s = selectorToString(sel)
      if (s) peers.push(`endpoints ${s}`)
    }
  }

  const requires = rule[`${prefix}Requires`]
  if (Array.isArray(requires)) {
    for (const sel of requires) {
      const s = selectorToString(sel)
      if (s) peers.push(`requires ${s}`)
    }
  }

  const cidrs = rule[`${prefix}CIDR`]
  if (Array.isArray(cidrs)) {
    for (const c of cidrs) peers.push(`CIDR ${c}`)
  }
  const cidrSet = rule[`${prefix}CIDRSet`]
  if (Array.isArray(cidrSet)) {
    for (const c of cidrSet) {
      if (c && c.cidr) {
        const except = Array.isArray(c.except) && c.except.length > 0
          ? ` except ${c.except.join(',')}`
          : ''
        peers.push(`CIDR ${c.cidr}${except}`)
      }
    }
  }
  const entities = rule[`${prefix}Entities`]
  if (Array.isArray(entities)) {
    for (const e of entities) peers.push(`entity ${e}`)
  }
  const fqdns = rule[`${prefix}FQDNs`]
  if (Array.isArray(fqdns)) {
    for (const f of fqdns) {
      if (f && f.matchName) peers.push(`FQDN ${f.matchName}`)
      else if (f && f.matchPattern) peers.push(`FQDN pattern ${f.matchPattern}`)
    }
  }
  const services = rule[`${prefix}Services`]
  if (Array.isArray(services)) {
    for (const sv of services) {
      if (sv && sv.k8sService) {
        const ns = sv.k8sService.namespace
        const nm = sv.k8sService.serviceName
        peers.push(`service ${ns ? `${ns}/` : ''}${nm}`)
      }
    }
  }

  if (peers.length === 0) {
    peers.push(direction === 'Ingress' ? 'any source' : 'any destination')
  }
  return peers
}

const portsFromToPorts = (toPorts: any): string[] => {
  if (!Array.isArray(toPorts)) return []
  const out: string[] = []
  for (const tp of toPorts) {
    if (Array.isArray(tp.ports)) {
      for (const p of tp.ports) {
        const proto = p.protocol || 'ANY'
        if (p.port) out.push(`${proto} ${p.port}`)
        else if (p.endPort) out.push(`${proto} ${p.port}-${p.endPort}`)
      }
    }
  }
  return out
}

const l7FromToPorts = (toPorts: any): string[] => {
  if (!Array.isArray(toPorts)) return []
  const out: string[] = []
  for (const tp of toPorts) {
    const r = tp.rules
    if (!r) continue
    if (Array.isArray(r.http)) {
      for (const h of r.http) {
        const m = h.method || ''
        const path = h.path || ''
        const host = h.host ? ` host=${h.host}` : ''
        out.push(`HTTP ${m || '*'} ${path || '*'}${host}`.trim())
      }
    }
    if (Array.isArray(r.dns)) {
      for (const d of r.dns) {
        if (d.matchName) out.push(`DNS ${d.matchName}`)
        else if (d.matchPattern) out.push(`DNS pattern ${d.matchPattern}`)
      }
    }
    if (Array.isArray(r.kafka)) {
      for (const k of r.kafka) {
        const role = k.role ? `${k.role} ` : ''
        const topic = k.topic || '*'
        out.push(`Kafka ${role}${topic}`)
      }
    }
  }
  return out
}

const summarizeK8sNetworkPolicy = (
  apiVersion: string,
  kind: string,
  spec: AnyObj
): PolicySummary => {
  const appliesTo = selectorToString(spec.podSelector) || 'all pods'
  const policyTypes: string[] = Array.isArray(spec.policyTypes)
    ? spec.policyTypes
    : []

  // For K8s NetworkPolicy, presence of a policyType means "deny everything
  // not listed" — each listed rule is therefore an Allow. We don't synthesise
  // an explicit deny entry, but we hint at it in the summary.
  const rules: PolicyRuleSummary[] = []
  if (policyTypes.includes('Ingress') || Array.isArray(spec.ingress)) {
    collectK8sRules(rules, spec.ingress, 'Ingress')
  }
  if (policyTypes.includes('Egress') || Array.isArray(spec.egress)) {
    collectK8sRules(rules, spec.egress, 'Egress')
  }

  return {
    apiVersion,
    kind,
    description:
      typeof spec.description === 'string' ? spec.description : undefined,
    appliesTo,
    rules,
    unknown: false,
  }
}

const collectK8sRules = (
  out: PolicyRuleSummary[],
  arr: any,
  direction: 'Ingress' | 'Egress'
): void => {
  if (!Array.isArray(arr) || arr.length === 0) {
    // Empty array = deny all (per K8s NetworkPolicy semantics)
    out.push({
      direction,
      action: 'Deny',
      peers: [direction === 'Ingress' ? 'all sources' : 'all destinations'],
      ports: [],
      l7: [],
    })
    return
  }
  for (const r of arr) {
    out.push({
      direction,
      action: 'Allow',
      peers: k8sPeers(direction === 'Ingress' ? r.from : r.to),
      ports: k8sPorts(r.ports),
      l7: [],
    })
  }
}

const k8sPeers = (peers: any): string[] => {
  if (!Array.isArray(peers) || peers.length === 0) return ['anywhere']
  const out: string[] = []
  for (const p of peers) {
    if (p.podSelector) {
      const s = selectorToString(p.podSelector)
      if (s) out.push(`pods ${s}`)
    }
    if (p.namespaceSelector) {
      const s = selectorToString(p.namespaceSelector)
      if (s) out.push(`namespaces ${s}`)
    }
    if (p.ipBlock && p.ipBlock.cidr) {
      const except =
        Array.isArray(p.ipBlock.except) && p.ipBlock.except.length > 0
          ? ` except ${p.ipBlock.except.join(',')}`
          : ''
      out.push(`CIDR ${p.ipBlock.cidr}${except}`)
    }
  }
  return out.length ? out : ['anywhere']
}

const k8sPorts = (ports: any): string[] => {
  if (!Array.isArray(ports)) return []
  return ports
    .map(p => {
      const proto = p.protocol || 'TCP'
      if (p.port === undefined && p.endPort === undefined) return proto
      const port = p.port
      const end = p.endPort ? `-${p.endPort}` : ''
      return `${proto} ${port}${end}`
    })
    .filter(Boolean)
}

const selectorToString = (sel: any, kind = ''): string => {
  if (!sel || typeof sel !== 'object') return ''
  const parts: string[] = []
  const ml = sel.matchLabels
  if (ml && typeof ml === 'object') {
    for (const [k, v] of Object.entries(ml)) {
      parts.push(`${k}=${String(v)}`)
    }
  }
  const me = sel.matchExpressions
  if (Array.isArray(me)) {
    for (const e of me) {
      const op = e.operator || ''
      const vals = Array.isArray(e.values) ? e.values.join(',') : ''
      parts.push(`${e.key} ${op}${vals ? ` [${vals}]` : ''}`)
    }
  }
  if (parts.length === 0) return kind ? `(any ${kind})` : '(any)'
  return `{${parts.join(', ')}}`
}
