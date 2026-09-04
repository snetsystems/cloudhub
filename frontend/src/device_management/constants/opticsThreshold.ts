import {OpticsThreshold} from 'src/types'

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
  | 'shutdown'
  | 'no_module'
  | 'error'

export const OPTICS_STATUS_LABEL: Record<OpticsPortStatus, string> = {
  ok: 'OK',
  low: 'LOW',
  hot: 'HOT',
  upstream: 'UPSTREAM',
  shutdown: 'SHUTDOWN',
  no_module: 'NO MODULE',
  error: 'ERROR',
}

/** Everything except OK reads as needing attention, except the two that don't. */
export const isOpticsFault = (status: OpticsPortStatus): boolean =>
  status !== 'ok' && status !== 'shutdown' && status !== 'no_module'

/**
 * Order matters, and it is not severity — it is which fact explains the port.
 * An operator-shut port explains itself, so it is never an alarm. An empty
 * cage is normal too. Only then does the sensor's own verdict apply, and only
 * a sensor the device calls valid is worth judging against thresholds.
 */
export const judgeOpticsPort = (
  port: {
    sensorStatus: string
    adminStatus?: string
    operStatus?: string
    /** False once the port stops reporting while its device keeps going. */
    isReporting: boolean
    tx: number | null
    rx: number | null
    temp: number | null
  },
  threshold: OpticsThreshold
): OpticsPortStatus => {
  if (port.adminStatus === 'down') {
    return 'shutdown'
  }
  // A device that never fitted a transceiver simply omits the sensor, so an
  // empty cage is invisible. What is visible — and what an operator needs — is
  // a port that was reporting and stopped: the module was pulled.
  if (
    !port.isReporting ||
    port.sensorStatus === 'no_module' ||
    port.operStatus === 'notPresent'
  ) {
    return 'no_module'
  }
  if (port.sensorStatus !== 'ok') {
    return 'error'
  }
  if (port.operStatus === 'lowerLayerDown') {
    return 'upstream'
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
