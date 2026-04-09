import {
  registerHost as registerAgent,
  updateHost as updateAgent,
  IPInterface,
  Disk,
  GPU,
  Host as Agent,
  HostRegistrationPayload,
  HostStatus,
} from 'src/shared/apis/host'
import {
  getLocalGrainsItem,
  getLocalGrainsItemBatch,
  getLocalMountActive,
  getLocalMountActiveBatch,
  getLocalDiskUsage,
  getLocalDiskUsageBatch,
} from 'src/shared/apis/saltStack'

export function buildAgentPayloadFromGrains(
  host: string,
  grains: Record<string, any>,
  mountActive: Record<string, any>,
  status: HostStatus = 'accepted'
) {
  const ipIfaceRaw: Record<string, string[]> = grains.ip_interfaces ?? {}
  const ipInterfaces: IPInterface[] = Object.entries(ipIfaceRaw).flatMap(
    ([interfaceName, addresses]) =>
      (addresses as string[]).map(ipAddress => ({interfaceName, ipAddress}))
  )

  const isWindows = String(grains.kernel ?? '').toLowerCase() === 'windows'

  const disks: Disk[] = isWindows
    ? Object.keys(mountActive).map(drive => ({
        device: drive,
        mountPoint: drive,
      }))
    : Object.entries(mountActive)
        .filter(([_, info]) =>
          String((info as any)?.device ?? '').startsWith('/dev/')
        )
        .map(([mountPoint, info]: [string, any]) => ({
          device: String((info as any)?.device ?? ''),
          mountPoint,
        }))

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
    disks,
    gpus,
    status,
  }
}

/** Grains + disk/mount from Salt as a host registration payload (for single PUT/POST or bulk-upsert). */
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
  const isWindows = String(grains.kernel ?? '').toLowerCase() === 'windows'

  let diskData: Record<string, any> = {}
  try {
    if (isWindows) {
      const diskResp = await getLocalDiskUsage(
        saltMasterUrl,
        saltMasterToken,
        host
      )
      const data = diskResp?.data?.return?.[0]?.[host]
      if (data != null && typeof data === 'object') diskData = data
    } else {
      const mountResp = await getLocalMountActive(
        saltMasterUrl,
        saltMasterToken,
        host
      )
      const data = mountResp?.data?.return?.[0]?.[host]
      if (data != null && typeof data === 'object') diskData = data
    }
  } catch (_) {}

  return {
    minionId: host,
    sourceType: 'salt',
    isCollector: false,
    ...buildAgentPayloadFromGrains(host, grains, diskData, status),
  }
}

export interface MinionSaltCollectError {
  host: string
  reason: string
}

/**
 * Fetches grains + mount/disk for many minions using Salt tgt_type=list (fewer HTTP calls than per-host).
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

  const linuxHosts: string[] = []
  const windowsHosts: string[] = []
  for (const host of hosts) {
    const g = grainsByHost.get(host)
    if (!g) continue
    if (String(g.kernel ?? '').toLowerCase() === 'windows') {
      windowsHosts.push(host)
    } else {
      linuxHosts.push(host)
    }
  }

  const diskDataByHost = new Map<string, Record<string, any>>()

  if (linuxHosts.length > 0) {
    try {
      const mountResp = await getLocalMountActiveBatch(
        saltMasterUrl,
        saltMasterToken,
        linuxHosts
      )
      const mountReturn = mountResp?.data?.return?.[0] ?? {}
      for (const host of linuxHosts) {
        const data = mountReturn[host]
        if (data != null && typeof data === 'object' && !Array.isArray(data)) {
          diskDataByHost.set(host, data as Record<string, any>)
        } else {
          diskDataByHost.set(host, {})
        }
      }
    } catch (_) {
      for (const host of linuxHosts) {
        diskDataByHost.set(host, {})
      }
    }
  }

  if (windowsHosts.length > 0) {
    try {
      const diskResp = await getLocalDiskUsageBatch(
        saltMasterUrl,
        saltMasterToken,
        windowsHosts
      )
      const diskReturn = diskResp?.data?.return?.[0] ?? {}
      for (const host of windowsHosts) {
        const data = diskReturn[host]
        if (data != null && typeof data === 'object' && !Array.isArray(data)) {
          diskDataByHost.set(host, data as Record<string, any>)
        } else {
          diskDataByHost.set(host, {})
        }
      }
    } catch (_) {
      for (const host of windowsHosts) {
        diskDataByHost.set(host, {})
      }
    }
  }

  const payloads: HostRegistrationPayload[] = []
  for (const host of hosts) {
    const grains = grainsByHost.get(host)
    if (!grains) continue
    const disk = diskDataByHost.get(host) ?? {}
    payloads.push({
      minionId: host,
      sourceType: 'salt',
      isCollector: false,
      ...buildAgentPayloadFromGrains(host, grains, disk, status),
    })
  }

  return {payloads, errors}
}

/**
 * Fetches grains + disk/mount from Salt and upserts the host row (same as per-row refresh).
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
