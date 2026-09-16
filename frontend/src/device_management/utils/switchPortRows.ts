import {
  ETHERNET_CSMACD,
  LONG_DOWN_TICKS,
  PortLinkStatus,
  interfaceInitTicks,
  judgePortLink,
  portLinkRank,
  portLinkSeverity,
} from 'src/device_management/constants/portLinkStatus'
import {comparePorts} from 'src/device_management/utils/ifName'
import {toISO} from 'src/device_management/utils/influxSeries'
import {DeviceData, SwitchPortDeviceRow, SwitchPortRow} from 'src/types'

/** One interface's last link state, as the ports query returns it. */
export interface SwitchPortSeries {
  devID: string
  ifName: string
  alias: string
  admin: string
  oper: string
  ifType: number | null
  ifLastChange: number | null
  checkedAt: number | null
}

/** What the device query says about a switch. */
export interface SwitchDeviceMeta {
  devID: string
  sysName: string
  agentHost: string
  model: string
  /** sysUpTime in ticks; null when the collector sent none. */
  uptimeTicks: number | null
}

const OTHER: PortLinkStatus[] = ['upstream', 'not_present', 'unknown']

// IANAifType has no 0: the smallest value is other(1). A collector that has
// not been updated to send ifType writes -1, but a half-rolled-out template
// that references an unresolved ifType field resolves to 0 instead — both
// are excluded here as "not reported".
const hasIfType = (p: SwitchPortSeries) =>
  typeof p.ifType === 'number' && p.ifType > 0

/**
 * One row per switch with its physical ports judged and counted.
 *
 * ifType decides what a physical port is. A switch whose collector has not
 * been updated to send it is left out and counted instead: guessing from
 * interface names would put VLANs and bundles in the counts.
 */
export const buildSwitchPortRows = (
  series: SwitchPortSeries[],
  meta: Record<string, SwitchDeviceMeta>,
  devices: Record<string, DeviceData>,
  longDownTicks: number = LONG_DOWN_TICKS
): {rows: SwitchPortDeviceRow[]; devicesWithoutIfType: number} => {
  const byDevice = new Map<string, SwitchPortSeries[]>()
  series.forEach(s => {
    if (!byDevice.has(s.devID)) {
      byDevice.set(s.devID, [])
    }
    byDevice.get(s.devID).push(s)
  })

  let devicesWithoutIfType = 0
  const rows: SwitchPortDeviceRow[] = []

  byDevice.forEach((interfaces, devID) => {
    if (!interfaces.some(hasIfType)) {
      devicesWithoutIfType++
      return
    }
    const initTicks = interfaceInitTicks(interfaces)
    const uptime = meta[devID]?.uptimeTicks ?? null

    const ports: SwitchPortRow[] = interfaces
      .filter(p => p.ifType === ETHERNET_CSMACD)
      .map(p => {
        const status = judgePortLink(
          {
            ifAdminStatus: p.admin,
            ifOperStatus: p.oper,
            ifType: p.ifType,
            ifLastChange: p.ifLastChange,
          },
          initTicks,
          uptime,
          longDownTicks
        )
        const isAgeKnown =
          uptime !== null &&
          typeof p.ifLastChange === 'number' &&
          p.ifLastChange >= 0 &&
          uptime >= p.ifLastChange
        return {
          id: `${devID}|${p.ifName}`,
          devID,
          ifName: p.ifName,
          alias: p.alias,
          admin: p.admin,
          oper: p.oper,
          status,
          sinceChangeTicks: isAgeKnown ? uptime - p.ifLastChange : null,
        }
      })
      .sort(
        (a, b) =>
          portLinkRank(a.status) - portLinkRank(b.status) || comparePorts(a, b)
      )

    const count = (statuses: PortLinkStatus[]) =>
      ports.filter(p => statuses.includes(p.status)).length
    const severities = ports.map(p => portLinkSeverity(p.status))
    const device = devices[devID]
    const latest = Math.max(...interfaces.map(p => p.checkedAt ?? 0))

    rows.push({
      id: devID,
      sysName: meta[devID]?.sysName || device?.hostname || devID,
      model: meta[devID]?.model ?? '',
      // The device list is scoped to the session's organization; the polled
      // address is the same IP and always travels with the data.
      ip: device?.device_ip || meta[devID]?.agentHost || '',
      location: device?.location ?? '',
      up: count(['up']),
      down: count(['down']),
      longDown: count(['long_down']),
      shutdown: count(['shutdown']),
      unused: count(['unused']),
      other: count(OTHER),
      severity: severities.includes('fail')
        ? 'fail'
        : severities.includes('ok')
        ? 'ok'
        : 'none',
      checkedAt: toISO(latest || null),
      ports,
    })
  })

  return {rows, devicesWithoutIfType}
}

/** "53.0d ago", "3.0h ago", "5m ago" from ticks since the last change. */
export const formatSinceChange = (ticks: number | null): string => {
  if (ticks === null) {
    return '-'
  }
  const seconds = ticks / 100
  if (seconds >= 86400) {
    return `${(seconds / 86400).toFixed(1)}d ago`
  }
  if (seconds >= 3600) {
    return `${(seconds / 3600).toFixed(1)}h ago`
  }
  return `${Math.floor(seconds / 60)}m ago`
}
