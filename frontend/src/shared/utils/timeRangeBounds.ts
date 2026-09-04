import {parseDuration} from 'src/utils/influxDuration'
import {TimeRange} from 'src/types'

/** Milliseconds per InfluxDuration part, in the order parseDuration returns. */
const PART_MS = [
  604800000, // w
  86400000, // d
  3600000, // h
  60000, // m
  1000, // s
  1, // ms
  0.001, // us
  0.000001, // ns
]

const RELATIVE = /^\s*now\(\)\s*-\s*(.+?)\s*$/i

/**
 * Resolves one end of a dashboard time range to epoch milliseconds.
 *
 * A bound is either relative to now (`now() - 15m`), an absolute timestamp —
 * which CloudHub stores quoted, as InfluxQL wants it — or absent, which for an
 * upper bound means now. Returns null when it is neither.
 */
export const resolveTimeBound = (
  value: string | null | undefined,
  now: number
): number | null => {
  if (!value) {
    return null
  }

  const relative = value.match(RELATIVE)
  if (relative) {
    const ms = parseDuration(relative[1]).reduce(
      (total, part, index) => total + part * PART_MS[index],
      0
    )
    return ms > 0 ? now - ms : null
  }

  const parsed = Date.parse(value.replace(/'/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Resolves a dashboard time range to an epoch-millisecond window, or null when
 * the lower bound cannot be read. An absent upper bound means now, so a
 * relative range slides while an absolute one stays put.
 */
export const resolveTimeRangeBounds = (
  timeRange: TimeRange | null | undefined,
  now: number = Date.now()
): [number, number] | null => {
  const from = resolveTimeBound(timeRange?.lower, now)
  if (from === null) {
    return null
  }

  const to = resolveTimeBound(timeRange?.upper, now) ?? now
  return to > from ? [from, to] : null
}
