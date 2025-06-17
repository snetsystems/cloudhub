import moment from 'moment'
import {CloudTimeRange} from 'src/clouds/types'
import {
  FilteredLogsForLogAnalysis,
  LogsFilterClause,
  TimeZones,
} from 'src/types'

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
  const defaultLower = timeRange?.lower ?? ''
  const defaultUpper = timeRange?.upper ?? ''

  const combined: FilteredLogsForLogAnalysis = [...baseFilters]
  const hasTime = combined.some(
    clause => 'range' in clause && Object.keys(clause.range)[0] === '@timestamp'
  )
  if (!hasTime) {
    combined.push({
      range: {
        '@timestamp': {
          format: 'strict_date_optional_time',
          gte: defaultLower,
          lte: defaultUpper,
        },
      },
    })
  }
  return combined
}
export const getLogsFilterLabel = (filter: LogsFilterClause): string => {
  if ('match_phrase' in filter) {
    const key = Object.keys(filter.match_phrase)[0]
    const value = filter.match_phrase[key]
    return `${key} == ${value}`
  }

  if ('range' in filter) {
    const field = Object.keys(filter.range)[0]
    const {gte, lte} = filter.range[field]
    const parts: string[] = []
    if (gte !== undefined) parts.push(`>= ${gte}`)
    if (lte !== undefined) parts.push(`<= ${lte}`)
    return `${field} ${parts.join(' and ')}`
  }

  if ('kql' in filter) {
    return filter.kql
  }
  return ''
}
