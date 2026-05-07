import {
  registerHost as registerAgent,
  updateHost as updateAgent,
  IPInterface,
  GPU,
  Host as Agent,
  HostRegistrationPayload,
  HostStatus,
  bulkUpsertHosts,
} from 'src/shared/apis/host'
import {
  getLocalGrainsItem,
  getLocalGrainsItemBatch,
  getLocalNetworkDefaultRoute,
  getLocalNetworkDefaultRouteBatch,
} from 'src/shared/apis/saltStack'

interface DefaultRouteEntry {
  destination?: string
  interface?: string
  metric?: number | string
}

function isLikelyContainerOrVirtualIface(interfaceName: string): boolean {
  return /^(lo|docker\d*|veth.*|br-.*|cni.*|flannel.*|virbr\d*|zt.*)$/i.test(
    interfaceName
  )
}

function isIPv4Address(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false
    const n = Number(part)
    return n >= 0 && n <= 255
  })
}

function isLoopbackIPv4(ip: string): boolean {
  return ip.startsWith('127.')
}

function isLinkLocalIPv4(ip: string): boolean {
  return ip.startsWith('169.254.')
}

function isPrivateIPv4(ip: string): boolean {
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1])
    return second >= 16 && second <= 31
  }
  return false
}

function scoreIPAddress(ip: string): number {
  if (!isIPv4Address(ip)) return 100
  if (isLoopbackIPv4(ip) || isLinkLocalIPv4(ip)) return 90
  if (isPrivateIPv4(ip)) return 0
  return 10
}

function sortPreferredIPv4(ipInterfaces: IPInterface[]): IPInterface[] {
  return [...ipInterfaces]
    .filter(iface => scoreIPAddress(String(iface.ipAddress ?? '')) < 100)
    .sort(
      (a, b) =>
        scoreIPAddress(String(a.ipAddress ?? '')) -
        scoreIPAddress(String(b.ipAddress ?? ''))
    )
}

function parseMetric(metric: unknown): number {
  if (typeof metric === 'number' && Number.isFinite(metric)) return metric
  if (typeof metric === 'string' && metric.trim() !== '') {
    const parsed = Number(metric)
    if (Number.isFinite(parsed)) return parsed
  }
  return Number.MAX_SAFE_INTEGER
}

function isDefaultRouteDestination(destination?: string): boolean {
  return destination === '0.0.0.0' || destination === 'default'
}

function normalizeDefaultRouteEntries(routeValue: any): DefaultRouteEntry[] {
  if (!routeValue) return []
  if (Array.isArray(routeValue)) return routeValue as DefaultRouteEntry[]
  if (typeof routeValue === 'object') {
    const inet = (routeValue as Record<string, any>).inet
    if (Array.isArray(inet)) return inet as DefaultRouteEntry[]
  }
  return []
}

function flattenIPInterfacesFromGrains(grains: Record<string, any>): IPInterface[] {
  const ipIfaceRaw: Record<string, string[]> = grains.ip_interfaces ?? {}
  return Object.entries(ipIfaceRaw).flatMap(([interfaceName, addresses]) =>
    (addresses as string[]).map(ipAddress => ({interfaceName, ipAddress}))
  )
}

function extractStrictDefaultInterfaceName(routeValue: any): string | undefined {
  const entries = normalizeDefaultRouteEntries(routeValue)
    .filter(
      entry =>
        entry &&
        typeof entry.interface === 'string' &&
        entry.interface.trim() !== '' &&
        isDefaultRouteDestination(entry.destination)
    )
    .filter(entry => !isLikelyContainerOrVirtualIface(String(entry.interface)))
    .sort((a, b) => parseMetric(a.metric) - parseMetric(b.metric))

  if (entries.length === 0) return undefined
  return String(entries[0].interface)
}

function selectDefaultInterfaceName(
  grains: Record<string, any>,
  routeValue: any
): string | undefined {
  const interfaceName = extractStrictDefaultInterfaceName(routeValue)
  if (!interfaceName) return undefined

  const hasUsableIPv4 = flattenIPInterfacesFromGrains(grains)
    .filter(iface => iface.interfaceName === interfaceName)
    .some(iface => scoreIPAddress(String(iface.ipAddress ?? '')) < 90)

  return hasUsableIPv4 ? interfaceName : undefined
}

function prioritizeIPInterfacesByDefaultRoute(
  ipInterfaces: IPInterface[],
  defaultInterfaceName?: string
): IPInterface[] {
  if (!defaultInterfaceName) return ipInterfaces

  const prioritizedRaw = ipInterfaces.filter(
    iface => iface.interfaceName === defaultInterfaceName
  )
  if (prioritizedRaw.length === 0) return ipInterfaces

  const prioritized = sortPreferredIPv4(prioritizedRaw)
  if (prioritized.length === 0) return ipInterfaces

  const others = ipInterfaces.filter(
    iface => iface.interfaceName !== defaultInterfaceName
  )
  return [...prioritized, ...others]
}

export function buildAgentPayloadFromGrains(
  host: string,
  grains: Record<string, any>,
  status: HostStatus = 'accepted',
  defaultInterfaceName?: string
) {
  const ipIfaceRaw: Record<string, string[]> = grains.ip_interfaces ?? {}
  const flattenedIPInterfaces: IPInterface[] = Object.entries(ipIfaceRaw).flatMap(
    ([interfaceName, addresses]) =>
      (addresses as string[]).map(ipAddress => ({interfaceName, ipAddress}))
  )
  const ipInterfaces = prioritizeIPInterfacesByDefaultRoute(
    flattenedIPInterfaces,
    defaultInterfaceName
  )

  const gpusRaw = grains.gpus
  const gpus: GPU[] = gpusRaw
    ? Object.entries(gpusRaw as Record<string, any>).map(([, g]: [string, any]) => ({
        vendor: String(g.vendor ?? ''),
        model: String(g.model ?? ''),
      }))
    : []

  const selinuxRaw = grains.selinux
  const selinuxState: string =
    selinuxRaw && typeof selinuxRaw === 'object'
      ? String(selinuxRaw.mode ?? selinuxRaw.enforced ?? '')
      : ''

  return {
    hostname: host,
    originalHostname: String(grains.hostname ?? host),
    ipInterfaces,
    os: String(grains.os ?? ''),
    osFamily: String(grains.os_family ?? grains.osfamily ?? ''),
    osVersion: String(grains.osrelease ?? ''),
    kernel: String(grains.kernel ?? ''),
    arch: String(grains.cpuarch ?? ''),
    memTotalKb: parseInt(grains.mem_total ?? '0', 10) * 1024,
    swapTotalKb: parseInt(grains.swap_total ?? '0', 10) * 1024,
    cpuCores: parseInt(grains.num_cpus ?? '0', 10),
    cpuModel: String(grains.cpu_model ?? ''),
    biosVersion: String(grains.biosversion ?? ''),
    timezone: String(grains.locale_info?.timezone ?? ''),
    selinuxState,
    gpus,
    status,
  }
}

/** Grains from Salt as a host registration payload (for single PUT/POST or bulk-upsert). */
export async function collectMinionHostPayloadFromSalt(
  saltMasterUrl: string,
  saltMasterToken: string,
  host: string,
  status: HostStatus = 'accepted'
): Promise<HostRegistrationPayload> {
  const [grainsResp, defaultRouteResp] = await Promise.all([
    getLocalGrainsItem(saltMasterUrl, saltMasterToken, host),
    getLocalNetworkDefaultRoute(saltMasterUrl, saltMasterToken, host).catch(
      () => undefined
    ),
  ])
  const grains = grainsResp?.data?.return?.[0]?.[host] ?? {}
  const defaultInterfaceName = selectDefaultInterfaceName(
    grains,
    defaultRouteResp?.data?.return?.[0]?.[host]
  )

  return {
    minionId: host,
    sourceType: 'salt',
    isCollector: false,
    ...buildAgentPayloadFromGrains(host, grains, status, defaultInterfaceName),
  }
}

export interface MinionSaltCollectError {
  host: string
  reason: string
}

/**
 * Fetches grains for many minions using Salt tgt_type=list (fewer HTTP calls than per-host).
 */
export async function collectMinionHostPayloadsFromSaltBatch(
  saltMasterUrl: string,
  saltMasterToken: string,
  hosts: string[],
  status: HostStatus = 'accepted'
): Promise<{
  payloads: HostRegistrationPayload[]
  errors: MinionSaltCollectError[]
}> {
  if (hosts.length === 0) {
    return {payloads: [], errors: []}
  }

  if (hosts.length === 1) {
    const h = hosts[0]
    try {
      const payload = await collectMinionHostPayloadFromSalt(
        saltMasterUrl,
        saltMasterToken,
        h,
        status
      )
      return {payloads: [payload], errors: []}
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      return {payloads: [], errors: [{host: h, reason}]}
    }
  }

  let grainsReturn: Record<string, any>
  let defaultRouteReturn: Record<string, any> = {}
  try {
    const [grainsResp, defaultRouteResp] = await Promise.all([
      getLocalGrainsItemBatch(
        saltMasterUrl,
        saltMasterToken,
        hosts
      ),
      getLocalNetworkDefaultRouteBatch(
        saltMasterUrl,
        saltMasterToken,
        hosts
      ).catch(() => ({data: {return: [{}]}})),
    ])
    grainsReturn = grainsResp?.data?.return?.[0] ?? {}
    defaultRouteReturn = defaultRouteResp?.data?.return?.[0] ?? {}
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return {
      payloads: [],
      errors: hosts.map(host => ({host, reason})),
    }
  }

  const errors: MinionSaltCollectError[] = []
  const grainsByHost = new Map<string, Record<string, any>>()

  for (const host of hosts) {
    const g = grainsReturn[host]
    if (!g || typeof g !== 'object' || Array.isArray(g)) {
      errors.push({
        host,
        reason: 'grains unavailable or minion not responding',
      })
      continue
    }
    grainsByHost.set(host, g as Record<string, any>)
  }

  const payloads: HostRegistrationPayload[] = []
  for (const host of hosts) {
    const grains = grainsByHost.get(host)
    if (!grains) continue
    const defaultInterfaceName = selectDefaultInterfaceName(
      grains,
      defaultRouteReturn[host]
    )
    payloads.push({
      minionId: host,
      sourceType: 'salt',
      isCollector: false,
      ...buildAgentPayloadFromGrains(
        host,
        grains,
        status,
        defaultInterfaceName
      ),
    })
  }

  return {payloads, errors}
}

/**
 * Fetches grains from Salt and upserts the host row (same as per-row refresh).
 */
export async function syncMinionFromSaltToDb(
  saltMasterUrl: string,
  saltMasterToken: string,
  host: string,
  agents: Agent[],
  status: HostStatus = 'accepted'
): Promise<void> {
  const payload = await collectMinionHostPayloadFromSalt(
    saltMasterUrl,
    saltMasterToken,
    host,
    status
  )
  const existsInDb = agents.some(a => a.minionId === host)
  if (existsInDb) {
    await updateAgent(host, payload)
  } else {
    await registerAgent(payload)
  }
}

export async function batchSyncAcceptedMinionsToDb(
  saltMasterUrl: string,
  saltMasterToken: string,
  targets: string[]
) {
  if (targets.length === 0) return {ok: 0, fail: 0, allFailDetails: []}

  const {
    payloads,
    errors: saltFailDetails,
  } = await collectMinionHostPayloadsFromSaltBatch(
    saltMasterUrl,
    saltMasterToken,
    targets,
    'accepted'
  )

  let ok = 0
  let apiFailDetails: Array<{host: string; reason: string}> = []

  if (payloads.length > 0) {
    try {
      const resp = await bulkUpsertHosts(payloads)
      ok = resp.created.length + resp.updated.length
      apiFailDetails = resp.failed.map(f => ({host: f.hostname, reason: f.error}))
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      apiFailDetails = payloads.map(p => ({host: p.hostname, reason}))
    }
  }

  return {
    ok,
    fail: saltFailDetails.length + apiFailDetails.length,
    allFailDetails: [...saltFailDetails, ...apiFailDetails],
  }
}
