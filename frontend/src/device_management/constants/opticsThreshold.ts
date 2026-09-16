import {OpticsThreshold} from 'src/types'
import {
  LONG_DOWN_TICKS,
  judgePortLink,
} from 'src/device_management/constants/portLinkStatus'

/**
 * Applied until an organization saves its own thresholds.
 *
 * -17 dBm is the PoC acceptance criterion for both Rx and Tx optical power.
 * 75 °C is the transceiver case temperature alarm point commonly published for
 * SFP modules — review it against the deployed optics before relying on it.
 */
export const DEFAULT_OPTICS_THRESHOLD: OpticsThreshold = {
  rx_low_dbm: -17,
  tx_low_dbm: -17,
  temp_high_c: 75,
  alert_enabled: false,
}

/**
 * Gauge scales are derived from the thresholds rather than configured
 * separately: a scale that does not contain its own threshold cannot be read.
 * Optical power tops out at 0 dBm on the display; the low end leaves a margin
 * below the threshold so a failing port still has travel left to show.
 */
export const OPTICAL_POWER_MARGIN_DBM = 3
export const TEMPERATURE_MARGIN_C = 15

export const opticalPowerRange = (lowDbm: number) => ({
  min: lowDbm - OPTICAL_POWER_MARGIN_DBM,
  max: 0,
})

export const temperatureRange = (highC: number) => ({
  min: 0,
  max: highC + TEMPERATURE_MARGIN_C,
})

/** How a port reads once the sensor, the link and the thresholds are combined. */
export type OpticsPortStatus =
  | 'ok'
  | 'low'
  | 'hot'
  | 'upstream'
  | 'down'
  | 'long_down'
  | 'shutdown'
  | 'no_module'
  | 'unused'
  | 'error'

export const OPTICS_STATUS_LABEL: Record<OpticsPortStatus, string> = {
  ok: 'OK',
  low: 'LOW',
  hot: 'HOT',
  upstream: 'UPSTREAM',
  down: 'DOWN',
  long_down: 'LONG DOWN',
  shutdown: 'SHUTDOWN',
  no_module: 'NO MODULE',
  unused: 'UNUSED',
  error: 'ERROR',
}

/**
 * How bad a status is, which is a different axis from what it is.
 *
 * The statuses say what explains a port; this says what an operator has to do
 * about it. The line is whether traffic is flowing: a port over its threshold
 * is degrading and will likely fail, but it is carrying traffic now, so it is
 * a warning. A port that is down is carrying nothing, so it is a fault.
 * `none` is for the states nobody is meant to act on.
 */
export type OpticsSeverity = 'ok' | 'warn' | 'fail' | 'none'

const SEVERITY_BY_STATUS: Record<OpticsPortStatus, OpticsSeverity> = {
  ok: 'ok',
  // Over threshold, still passing traffic.
  low: 'warn',
  hot: 'warn',
  // Not passing traffic.
  error: 'fail',
  upstream: 'fail',
  down: 'fail',
  // Expected states: an operator shut the port, the cage is empty, or the
  // link has never come up since boot.
  shutdown: 'none',
  no_module: 'none',
  unused: 'none',
  // Down long enough to be retired cabling, not an active incident.
  long_down: 'none',
}

export const opticsSeverity = (status: OpticsPortStatus): OpticsSeverity =>
  SEVERITY_BY_STATUS[status] ?? 'none'

/** Worst first, so a device reads as its worst port. */
const SEVERITY_RANK: Record<OpticsSeverity, number> = {
  fail: 3,
  warn: 2,
  ok: 1,
  none: 0,
}

/**
 * A device reads as its worst port. Ports nobody acts on leave the verdict
 * alone, so a device whose only unusual port is an empty cage still reads OK.
 */
export const worstOpticsSeverity = (
  statuses: OpticsPortStatus[]
): OpticsSeverity =>
  statuses
    .map(opticsSeverity)
    .reduce(
      (worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst),
      'none' as OpticsSeverity
    )

/**
 * Order matters, and it is not severity — it is which fact explains the port.
 * The link facts come from portLinkStatus, shared with the switch ports cell,
 * so the two can never judge one port differently. An operator-shut port
 * explains itself, so it is never an alarm. An empty cage is normal too. Only
 * then does the sensor's own verdict apply, and only a sensor the device calls
 * valid is worth judging against thresholds.
 */
export const judgeOpticsPort = (
  port: {
    sensorStatus: string
    adminStatus?: string
    operStatus?: string
    /** TimeTicks of the last oper change; -1 or absent when unknown. */
    ifLastChange?: number | null
    /** False once the port stops reporting while its device keeps going. */
    isReporting: boolean
    tx: number | null
    rx: number | null
    temp: number | null
  },
  threshold: OpticsThreshold,
  /** The device's interface-init tick; null leaves unused undecided. */
  initTicks: number | null = null,
  /** The device's sysUpTime in ticks; null leaves long_down undecided. */
  uptimeTicks: number | null = null,
  /** 0 or less disables the verdict, same as judgePortLink. Shared with the
   * switch ports cell so the two can never judge one port differently. */
  longDownTicks: number = LONG_DOWN_TICKS
): OpticsPortStatus => {
  const link = judgePortLink(
    {
      ifAdminStatus: port.adminStatus,
      ifOperStatus: port.operStatus,
      ifLastChange: port.ifLastChange,
    },
    initTicks,
    uptimeTicks,
    longDownTicks
  )
  if (link === 'shutdown') {
    return 'shutdown'
  }
  // A device that never fitted a transceiver simply omits the sensor, so an
  // empty cage is invisible. What is visible — and what an operator needs — is
  // a port that was reporting and stopped: the module was pulled.
  if (
    !port.isReporting ||
    port.sensorStatus === 'no_module' ||
    link === 'not_present'
  ) {
    return 'no_module'
  }
  // Only a status the device actually reported can condemn a port. A blank one
  // means the reading arrived without its status column, which says nothing
  // about the transceiver - judging it as a sensor fault turns a gap in the
  // collection into a rack of red ports.
  if (port.sensorStatus && port.sensorStatus !== 'ok') {
    return 'error'
  }
  if (link === 'upstream') {
    return 'upstream'
  }
  // A fitted module whose link has not changed since boot: nothing was ever
  // patched in, so it is not a fault.
  if (link === 'unused') {
    return 'unused'
  }
  // Down longer than the active-incident window: retired cabling, not a
  // fault to act on now.
  if (link === 'long_down') {
    return 'long_down'
  }
  // Admin up, oper down after the link had come up: nothing else explains this
  // port, and it is the one an operator most needs to see.
  if (link === 'down') {
    return 'down'
  }
  if (
    (port.rx !== null && port.rx < threshold.rx_low_dbm) ||
    (port.tx !== null && port.tx < threshold.tx_low_dbm)
  ) {
    return 'low'
  }
  if (port.temp !== null && port.temp > threshold.temp_high_c) {
    return 'hot'
  }
  return 'ok'
}
