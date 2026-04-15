import {
  registerHost as registerAgent,
  updateHost as updateAgent,
  IPInterface,
  GPU,
  Host as Agent,
  HostRegistrationPayload,
  HostStatus,
} from 'src/shared/apis/host'
import {getLocalGrainsItem, getLocalGrainsItemBatch} from 'src/shared/apis/saltStack'

export function buildAgentPayloadFromGrains(
  host: string,
  grains: Record<string, any>,
  status: HostStatus = 'accepted'
) {
  const ipIfaceRaw: Record<string, string[]> = grains.ip_interfaces ?? {}
  const ipInterfaces: IPInterface[] = Object.entries(ipIfaceRaw).flatMap(
    ([interfaceName, addresses]) =>
      (addresses as string[]).map(ipAddress => ({interfaceName, ipAddress}))
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
  const grainsResp = await getLocalGrainsItem(
    saltMasterUrl,
    saltMasterToken,
    host
  )
  const grains = grainsResp?.data?.return?.[0]?.[host] ?? {}

  return {
    minionId: host,
    sourceType: 'salt',
    isCollector: false,
    ...buildAgentPayloadFromGrains(host, grains, status),
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
  try {
    const grainsResp = await getLocalGrainsItemBatch(
      saltMasterUrl,
      saltMasterToken,
      hosts
    )
    grainsReturn = grainsResp?.data?.return?.[0] ?? {}
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
    payloads.push({
      minionId: host,
      sourceType: 'salt',
      isCollector: false,
      ...buildAgentPayloadFromGrains(host, grains, status),
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
