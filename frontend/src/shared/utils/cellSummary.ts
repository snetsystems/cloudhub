import moment from 'moment'
import {Query, TimeRange, Cell, CellSummary, CellSummaryItem} from 'src/types'
import {TimeSeriesServerResponse, TimeSeriesValue} from 'src/types/series'

export const toggleCellShowSummary = (
  cells: Cell[],
  cell: Cell,
  onPositionChange?: (cells: Cell[]) => void
): void => {
  if (!onPositionChange) {
    return
  }

  onPositionChange(
    cells.map(c =>
      String(c.i) === String(cell.i)
        ? {...c, isShowSummary: !c.isShowSummary}
        : c
    )
  )
}

interface BuildCellSummaryArgs {
  queries: Query[]
  responses: TimeSeriesServerResponse[]
  timeRange?: TimeRange
}

interface SummaryCandidate extends CellSummaryItem {
  rawLabel: string
  detailLabel: string | null
  aggregation: string | null
}

const toChartLabel = (
  measurement: string | undefined,
  field: string,
  tags?: {[key: string]: string}
): string => {
  const tagSet = Object.keys(tags || {})
    .sort()
    .map(tag => `[${tag}=${tags![tag]}]`)
    .join('')
  return `${measurement || ''}.${field}${tagSet}`
}

const toNumericValue = (value: TimeSeriesValue): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const parseRelativeTime = (
  value: string | undefined | null,
  now: moment.Moment
): moment.Moment | null => {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  if (trimmedValue === 'now()') {
    return now.clone()
  }

  const relativeMatch = trimmedValue.match(
    /^now\(\)\s*-\s*(\d+)(ms|s|m|h|d|w)$/i
  )
  if (relativeMatch) {
    const [, amountText, unit] = relativeMatch
    const amount = Number(amountText)
    if (!Number.isFinite(amount)) {
      return null
    }

    const unitMap = {
      ms: 'milliseconds',
      s: 'seconds',
      m: 'minutes',
      h: 'hours',
      d: 'days',
      w: 'weeks',
    } as const

    return now.clone().subtract(amount, unitMap[unit.toLowerCase()])
  }

  const parsed = moment.utc(trimmedValue)
  return parsed.isValid() ? parsed : null
}

const formatTimeRange = (timeRange?: TimeRange): string | null => {
  if (!timeRange?.lower) {
    return null
  }

  const now = moment.utc(Date.now())
  const lower = parseRelativeTime(timeRange.lower, now)
  const upper = parseRelativeTime(timeRange.upper || 'now()', now)

  if (lower?.isValid() && upper?.isValid()) {
    const upperFormat =
      lower.year() === upper.year() ? 'MM/DD, HH:mm:ss' : 'YYYY/MM/DD, HH:mm:ss'

    return `${lower.format('YYYY/MM/DD, HH:mm:ss')} ~ ${upper.format(
      upperFormat
    )}`
  }

  return [timeRange.lower, timeRange.upper].filter(Boolean).join(' ~ ') || null
}

const formatInterval = (
  rawInterval: string | null | undefined
): string | null => {
  if (!rawInterval) {
    return null
  }

  const trimmed = rawInterval.trim()
  const matched = trimmed.match(/^(\d+)(ms|s|m|h|d)$/i)
  if (!matched) {
    return trimmed
  }

  const [, amountText, unit] = matched
  const amount = Number(amountText)
  if (!Number.isFinite(amount)) {
    return trimmed
  }

  if (unit === 'ms') {
    if (amount % 3600000 === 0) {
      return `${amount / 3600000}h`
    }
    if (amount % 60000 === 0) {
      return `${amount / 60000} min`
    }
    if (amount % 1000 === 0) {
      return `${amount / 1000} sec`
    }
    return `${amount}ms`
  }

  const labelByUnit = {
    s: ' sec',
    m: ' min',
    h: 'h',
    d: 'd',
  }

  return `${amount}${labelByUnit[unit.toLowerCase()]}`
}

const getDefaultIntervalFromTimeRange = (
  timeRange?: TimeRange
): string | null => {
  if (!timeRange?.lower) {
    return null
  }

  const now = moment.utc(Date.now())
  const lower = parseRelativeTime(timeRange.lower, now)
  const upper = parseRelativeTime(timeRange.upper || 'now()', now)

  if (!lower?.isValid() || !upper?.isValid()) {
    return null
  }

  const duration = moment.duration(upper.diff(lower))

  if (duration.asMinutes() <= 5) return '10 sec'
  if (duration.asHours() <= 6) return '1 min'
  if (duration.asHours() <= 12) return '5 min'
  if (duration.asHours() <= 24) return '10 min'
  if (duration.asDays() <= 2) return '30 min'
  if (duration.asDays() <= 7) return '1h'
  return '6h'
}

const getQueryInterval = (
  queries: Query[],
  timeRange?: TimeRange
): string | null => {
  for (const query of queries) {
    const fromText = query.text?.match(/group by\s+time\(([^)]+)\)/i)?.[1]
    if (fromText) {
      if (fromText === ':interval:') {
        return getDefaultIntervalFromTimeRange(timeRange)
      }
      return formatInterval(fromText)
    }

    const fromConfig = query.queryConfig?.groupBy?.time
    if (fromConfig && fromConfig !== 'auto') {
      return formatInterval(fromConfig)
    }
  }

  return null
}

const getAggregation = (queries: Query[]): string | null => {
  const rawAggregation = queries
    .flatMap(query => query.queryConfig?.fields || [])
    .map(field => field?.value?.toLowerCase())
    .find(Boolean)

  return rawAggregation ?? null
}

const toDetailLabel = (tags?: {[key: string]: string}): string | null => {
  const tagEntries = Object.entries(tags || {})
  const hostTag = tags?.host
  if (hostTag) {
    return hostTag
  }

  if (tagEntries.length === 1) {
    return tagEntries[0][1]
  }

  if (tagEntries.length > 0) {
    return tagEntries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')
  }

  return null
}

const getRawLabel = (
  query: Query | undefined,
  fieldIndex: number,
  columnName: string | undefined,
  seriesName?: string
): string => {
  const alias = query?.queryConfig?.fields?.[fieldIndex]?.alias
  return alias || columnName || seriesName || 'value'
}

const getFieldAggregation = (
  query: Query | undefined,
  fieldIndex: number
): string | null =>
  query?.queryConfig?.fields?.[fieldIndex]?.value?.toLowerCase() ?? null

export const buildCellSummary = ({
  queries,
  responses,
  timeRange,
}: BuildCellSummaryArgs): CellSummary | null => {
  const candidates: SummaryCandidate[] = []

  responses.forEach((response, responseIndex) => {
    response?.response?.results?.forEach(result => {
      if (!('series' in result) || !result.series?.length) {
        return
      }

      result.series.forEach(series => {
        const columns = series.columns || []
        const rows = series.values || []

        columns.slice(1).forEach((columnName, columnOffset) => {
          let selectedValue: number | null = null
          let selectedTime: TimeSeriesValue = null

          rows.forEach(row => {
            const currentValue = toNumericValue(row[columnOffset + 1] ?? null)
            if (currentValue === null) {
              return
            }

            const currentTime = row[0] ?? null
            const shouldReplace =
              selectedValue === null ||
              currentValue > selectedValue ||
              (currentValue === selectedValue &&
                toNumericValue(currentTime) !== null &&
                toNumericValue(currentTime) > toNumericValue(selectedTime))

            if (shouldReplace) {
              selectedValue = currentValue
              selectedTime = currentTime
            }
          })

          if (selectedValue === null) {
            return
          }

          const query = queries[responseIndex]
          const rawLabel = getRawLabel(
            query,
            columnOffset,
            columnName,
            series.name
          )
          candidates.push({
            rawLabel,
            detailLabel: toDetailLabel(series.tags),
            label: rawLabel,
            value: selectedValue,
            time: selectedTime,
            chartLabel: toChartLabel(series.name, columnName, series.tags),
            aggregation: getFieldAggregation(query, columnOffset),
          })
        })
      })
    })
  })

  if (candidates.length === 0) {
    return null
  }

  const labelCounts = candidates.reduce((acc, candidate) => {
    acc[candidate.rawLabel] = (acc[candidate.rawLabel] || 0) + 1
    return acc
  }, {})

  const winner = candidates.reduce((selected, candidate) => {
    if (!selected) {
      return candidate
    }

    if (candidate.value > selected.value) {
      return candidate
    }

    if (
      candidate.value === selected.value &&
      toNumericValue(candidate.time) !== null &&
      toNumericValue(candidate.time) > toNumericValue(selected.time)
    ) {
      return candidate
    }

    return selected
  }, null as SummaryCandidate | null)

  if (!winner) {
    return null
  }

  const resolvedLabel =
    winner.detailLabel ||
    (labelCounts[winner.rawLabel] > 1 ? winner.label : winner.rawLabel)

  return {
    context: {
      timeRange: formatTimeRange(timeRange),
      interval: getQueryInterval(queries, timeRange),
      aggregation: winner.aggregation ?? getAggregation(queries),
      summaryType: 'Chart Max',
    },
    items: [
      {
        label: resolvedLabel,
        value: winner.value,
        time: winner.time,
        chartLabel: winner.chartLabel,
      },
    ],
  }
}
