import moment from 'moment'
import {CloudTimeRange} from 'src/clouds/types'
import {FilteredLogsForLogAnalysis, TimeZones} from 'src/types'

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
