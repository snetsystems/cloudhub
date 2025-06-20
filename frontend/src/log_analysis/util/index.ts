import moment from 'moment'
import {CloudTimeRange} from 'src/clouds/types'
import {
  FilteredLogsForLogAnalysis,
  LogsFilterClause,
  TimeZones,
} from 'src/types'
import {OperatorMeta, FIELD_OPERATOR_META} from '../constants/search-filter'

export const formattedTime = (
  timestampInput: string | null,
  targetZone: TimeZones
): string => {
  if (!timestampInput) {
    return '–'
  }

  const isMillisString = /^\d+$/.test(timestampInput)
  const timestampMillis = isMillisString ? Number(timestampInput) : undefined

  const utcMoment =
    timestampMillis !== undefined
      ? moment.utc(timestampMillis)
      : moment.utc(timestampInput)

  if (targetZone === TimeZones.UTC) {
    return utcMoment.format('YYYY-MM-DD HH:mm:ss')
  }

  return utcMoment.local().format('YYYY-MM-DD HH:mm:ss')
}

export const buildCombinedFilters = (
  baseFilters: FilteredLogsForLogAnalysis,
  timeRange?: CloudTimeRange['logAnalysis']
): FilteredLogsForLogAnalysis => {
  const {gteISO, lteISO} = lowerToESRange(timeRange)

  const combined: FilteredLogsForLogAnalysis = [...baseFilters]
  const hasTime = combined.some(
    clause => 'range' in clause && Object.keys(clause.range)[0] === '@timestamp'
  )
  if (!hasTime) {
    combined.push({
      range: {
        '@timestamp': {
          format: 'strict_date_optional_time',
          gte: gteISO,
          lte: lteISO,
        },
      },
    })
  }
  return combined
}
export const getLogsFilterLabel = (
  filter: LogsFilterClause,
  timeZone?: TimeZones
): string => {
  if ('match_phrase' in filter) {
    const key = Object.keys(filter.match_phrase)[0]
    const value = filter.match_phrase[key]

    return `${key}: ${value}`
  }

  if ('range' in filter) {
    const field = Object.keys(filter.range)[0]
    let {gte, lte} = filter.range[field]
    const parts: string[] = []

    if (field === '@timestamp' && timeZone) {
      const formattedGte = gte ? formattedTime(gte, timeZone) : undefined
      const formattedLte = lte ? formattedTime(lte, timeZone) : undefined
      if (formattedGte) parts.push(`>= ${formattedGte}`)
      if (formattedLte) parts.push(`<= ${formattedLte}`)
    } else {
      if (gte !== undefined) parts.push(`>= ${gte}`)
      if (lte !== undefined) parts.push(`<= ${lte}`)
    }

    return `${field} ${parts.join(' AND ')}`
  }

  if ('kql' in filter) {
    return filter.kql
  }

  return ''
}

export type RelativeExpr = `now() - ${number}${'s' | 'm' | 'h' | 'd' | 'w'}`
export type DateExpr =
  | RelativeExpr
  | 'now()'
  | string // ISO-8601 e.g. "2025-06-17T09:00:00Z"
  | null
  | undefined

export interface FluxLikeRange {
  lower?: DateExpr
  upper?: DateExpr
  format?: string
}

export interface ESRange {
  gteISO: string // lower  → gte
  lteISO: string // upper  → lte
}

const MS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
} as const

export function lowerToESRange(
  upperOrObj: DateExpr | FluxLikeRange,
  lowerMaybe?: DateExpr,
  nowDate: Date = new Date()
): ESRange {
  let lower: DateExpr
  let upper: DateExpr

  if (
    typeof upperOrObj === 'object' &&
    upperOrObj !== null &&
    ('lower' in upperOrObj || 'upper' in upperOrObj)
  ) {
    lower = upperOrObj.lower ?? null
    upper = upperOrObj.upper ?? 'now()'
  } else {
    upper = upperOrObj as DateExpr
    lower = lowerMaybe ?? null
  }

  const lteISO = toISO(upper, nowDate) // upper → lte
  const gteISO = toISO(lower, nowDate) // lower → gte

  if (new Date(gteISO).getTime() > new Date(lteISO).getTime()) {
    throw new Error(`lower(${gteISO})가 upper(${lteISO})보다 이후입니다.`)
  }

  return {gteISO, lteISO}
}

/* ---------------------------------------------------------------------- */
function toISO(expr: DateExpr, now: Date): string {
  if (!expr || expr.trim().toLowerCase() === 'now()') {
    return now.toISOString()
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(expr)) {
    return new Date(expr).toISOString()
  }

  const m = expr.match(/^now\(\)\s*-\s*(\d+)\s*([smhdw])$/i)
  if (m) {
    const amount = Number(m[1])
    const unit = m[2].toLowerCase() as keyof typeof MS
    return new Date(now.getTime() - amount * MS[unit]).toISOString()
  }

  throw new Error(`지원하지 않는 날짜 표현식: ${expr}`)
}

export const getFieldOperatorsWithLogical = (
  field: string,
  type: string
): OperatorMeta[] => {
  const ops = FIELD_OPERATOR_META[field] || FIELD_OPERATOR_META[type]

  return [...ops]
}
