/**
 * Link state of a switch port, judged from IF-MIB alone so an optical port and
 * a copper one read the same way.
 *
 * "Unused" follows what NMS templates mean by it: the link has not changed
 * since the interface came up at boot. ifLastChange holds the sysUpTime of the
 * last oper change, and a port nobody ever plugged in keeps the tick at which
 * the interface was initialised. That tick is not zero (150 s on a C9200L), so
 * each device is measured against its own earliest ethernet change rather than
 * a fixed threshold that a slower-booting chassis would overrun.
 */

import {SwitchPortThreshold} from 'src/types'

export type PortLinkStatus =
  | 'up'
  | 'down'
  | 'long_down'
  | 'shutdown'
  | 'unused'
  | 'upstream'
  | 'not_present'
  | 'unknown'

export type PortLinkSeverity = 'ok' | 'fail' | 'none'

export interface PortLinkInput {
  ifAdminStatus?: string
  ifOperStatus?: string
  /** IANAifType; -1 when the device did not report it. */
  ifType?: number | null
  /** TimeTicks since boot of the last oper change; -1 when not reported. */
  ifLastChange?: number | null
}

/** IANAifType ethernetCsmacd: the physical ports, not VLANs or bundles. */
export const ETHERNET_CSMACD = 6

/** Ports initialise within a second of each other; a minute is generous. */
export const UNUSED_MARGIN_TICKS = 6000

/** Ticks in a day (24 * 3600 * 100), so a days-based threshold and the ticks
 * judgePortLink works in can never disagree. */
const TICKS_PER_DAY = 8640000

/** Converts an operator-configured day count to the ticks judgePortLink takes. */
export const longDownDaysToTicks = (days: number): number =>
  days * TICKS_PER_DAY

/** Applied until an organization saves its own switch port threshold. */
export const DEFAULT_SWITCH_PORT_THRESHOLD: SwitchPortThreshold = {
  long_down_days: 7,
}

/**
 * The shipped default, in ticks: a down link older than this is retired
 * cabling, not an active incident, until an organization configures its own.
 * Nobody leaves a real fault unfixed for a week.
 */
export const LONG_DOWN_TICKS = longDownDaysToTicks(
  DEFAULT_SWITCH_PORT_THRESHOLD.long_down_days
)

const isKnownTicks = (value?: number | null): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/** The device's interface-init tick, or null when nothing can say. */
export const interfaceInitTicks = (ports: PortLinkInput[]): number | null => {
  const ticks = ports
    .filter(p => p.ifType === ETHERNET_CSMACD && isKnownTicks(p.ifLastChange))
    .map(p => p.ifLastChange as number)
  return ticks.length ? Math.min(...ticks) : null
}

/**
 * Order matters: an operator's shutdown explains a port before anything the
 * link reports, and a down link is only called unused when both its own change
 * time and the device baseline are known. Without them it stays down - a
 * missing value must not hide a fault.
 *
 * Within the down branch, `unused` is checked before `long_down`: a port
 * sitting at the interface-init tick is unused no matter how long the device
 * has been up, and on a long-running device that age alone would clear the
 * long-down threshold too. Testing age first would misjudge every unused port
 * on such a device as long_down instead.
 */
export const judgePortLink = (
  port: PortLinkInput,
  initTicks: number | null,
  uptimeTicks: number | null = null,
  /** 0 or less disables the verdict: long_down is never returned, the port stays down. */
  longDownTicks: number = LONG_DOWN_TICKS
): PortLinkStatus => {
  if (port.ifAdminStatus === 'down') {
    return 'shutdown'
  }
  switch (port.ifOperStatus) {
    case 'notPresent':
      return 'not_present'
    case 'up':
      return 'up'
    case 'lowerLayerDown':
      return 'upstream'
    case 'down':
      if (
        initTicks !== null &&
        isKnownTicks(port.ifLastChange) &&
        port.ifLastChange <= initTicks + UNUSED_MARGIN_TICKS
      ) {
        return 'unused'
      }
      if (
        longDownTicks > 0 &&
        isKnownTicks(uptimeTicks) &&
        isKnownTicks(port.ifLastChange) &&
        uptimeTicks - port.ifLastChange > longDownTicks
      ) {
        return 'long_down'
      }
      return 'down'
    default:
      return 'unknown'
  }
}

export const PORT_LINK_LABEL: Record<PortLinkStatus, string> = {
  up: 'UP',
  down: 'DOWN',
  long_down: 'LONG DOWN',
  shutdown: 'SHUTDOWN',
  unused: 'UNUSED',
  upstream: 'UPSTREAM',
  not_present: 'NOT PRESENT',
  unknown: 'UNKNOWN',
}

const SEVERITY_BY_LINK: Record<PortLinkStatus, PortLinkSeverity> = {
  up: 'ok',
  // Should carry traffic and does not.
  down: 'fail',
  upstream: 'fail',
  // Nobody is meant to act on these.
  long_down: 'none',
  shutdown: 'none',
  unused: 'none',
  not_present: 'none',
  unknown: 'none',
}

export const portLinkSeverity = (status: PortLinkStatus): PortLinkSeverity =>
  SEVERITY_BY_LINK[status] ?? 'none'

const RANK_BY_SEVERITY: Record<PortLinkSeverity, number> = {
  fail: 0,
  ok: 1,
  none: 2,
}

/** Sort key that puts faults first and ports nobody acts on last. */
export const portLinkRank = (status: PortLinkStatus): number =>
  RANK_BY_SEVERITY[portLinkSeverity(status)]
