import moment from 'moment'
import _ from 'lodash'
import {Query, TimeRange, Cell, CellSummary, CellSummaryItem, Template} from 'src/types'
import {TimeSeriesServerResponse, TimeSeriesSeries, TimeSeriesValue} from 'src/types/series'
import {
  CellType,
  FieldOption,
  GraphOptions,
  TableOptions,
} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'
import {groupByTimeSeriesTransform} from 'src/utils/groupByTimeSeriesTransform'
import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'
import {
  getFieldOptionsWithGroupByTags,
  parseIfPositiveNumber,
  staticGraphDatasets,
  isStaticGraphType,
} from 'src/shared/utils/staticGraph'

export type CellSummaryMode = 'show' | 'show-single-field' | 'hide'

interface IsShowInformationSupportedOptions {
  cellType: CellType
  isFluxQuery: boolean
  responses: TimeSeriesServerResponse[]
  fieldOptions: FieldOption[]
}

interface TimeSeriesSummaryOptions {
  queries: Query[]
  responses: TimeSeriesServerResponse[]
  timeRange?: TimeRange
}

interface SummaryCandidate extends CellSummaryItem {
  rawLabel: string
  detailLabel: string | null
  aggregation: string | null
}

interface StatisticalSummaryOptions {
  cellType: CellType
  queries: Query[]
  responses: TimeSeriesServerResponse[]
  timeRange?: TimeRange
  fieldOptions: FieldOption[]
  tableOptions: TableOptions
  colors: ColorString[]
  graphOptions: GraphOptions
  templates: Template[]
}

interface CellSummaryDisplayOptions {
  isShowSummaryOverlay?: boolean
  isFluxQuery: boolean
  cellType: CellType
  queries: Query[]
  responses: TimeSeriesServerResponse[]
  timeRange?: TimeRange
  colors: ColorString[]
  fieldOptions: FieldOption[]
  tableOptions: TableOptions
  graphOptions: GraphOptions
  templates: Template[]
}

const CELL_SUMMARY_CONFIG: Partial<Record<CellType, CellSummaryMode>> = {
  // Show Information — always
  [CellType.Line]: 'show',
  [CellType.Stacked]: 'show',
  [CellType.StepPlot]: 'show',
  [CellType.Bar]: 'show',
  [CellType.LinePlusSingleStat]: 'show',
  [CellType.StaticBar]: 'show',
  [CellType.StaticLineChart]: 'show',
  // Show Information — only with a single value field
  [CellType.StaticPie]: 'show-single-field',
  [CellType.StaticDoughnut]: 'show-single-field',
  [CellType.StaticStackedBar]: 'show-single-field',
  // Hide Show Information
  [CellType.StaticScatter]: 'hide',
  [CellType.StaticRadar]: 'hide',
  [CellType.StaticTableGaugeChart]: 'hide',
  [CellType.SingleStat]: 'hide',
  [CellType.Gauge]: 'hide',
  [CellType.Table]: 'hide',
  [CellType.Alerts]: 'hide',
  [CellType.News]: 'hide',
  [CellType.Guide]: 'hide',
  [CellType.Note]: 'hide',
}

const getRawSeries = (
  responses: TimeSeriesServerResponse[]
): TimeSeriesSeries[] =>
  _.get(responses, ['0', 'response', 'results', '0', 'series'], [])

const hasVisibleSingleValueField = (
  responses: TimeSeriesServerResponse[],
  fieldOptions: FieldOption[]
): boolean => {
  const rawData = getRawSeries(responses)
  if (!rawData.length) {
    return false
  }

  const tagKeys = Object.keys(rawData[0].tags || {})
  const visibleValueFieldCount = fieldOptions.filter(
    field =>
      field.internalName !== 'time' &&
      !tagKeys.includes(field.internalName) &&
      field.visible !== false
  ).length

  return visibleValueFieldCount === 1
}

// Whether "Show Information" is allowed for this cell type and data.
export const isShowInformationSupported = ({
  cellType,
  isFluxQuery,
  responses,
  fieldOptions,
}: IsShowInformationSupportedOptions): boolean => {
  if (isFluxQuery) {
    return false
  }

  const mode = CELL_SUMMARY_CONFIG[cellType] ?? 'hide'
  if (mode === 'hide') {
    return false
  }

  if (mode === 'show-single-field') {
    return hasVisibleSingleValueField(responses, fieldOptions)
  }

  // Static graphs still need at least one series; time-series graphs stay available.
  if (isStaticGraphType(cellType)) {
    return getRawSeries(responses).length > 0
  }

  return true
}

// Toggle isShowSummary on a dashboard cell.
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

// Build a chart label used to match a time-series line color.
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

// Find the highest value across all time-series fields and series.
export const buildTimeSeriesSummary = ({
  queries,
  responses,
  timeRange,
}: TimeSeriesSummaryOptions): CellSummary | null => {
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
      showTime: true,
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

// Find the highest visible value from static chart datasets and its color.
const buildStatisticalSummary = ({
  cellType,
  queries,
  responses,
  timeRange,
  fieldOptions,
  tableOptions,
  colors,
  graphOptions,
  templates,
}: StatisticalSummaryOptions): {
  summary: CellSummary | null
  itemColor?: string
} => {
  const rawData: TimeSeriesSeries[] = _.get(
    responses,
    ['0', 'response', 'results', '0', 'series'],
    []
  )

  const createDatasets = staticGraphDatasets(cellType)
  if (!createDatasets) {
    return {summary: null}
  }

  const {labels, datasets} = createDatasets({
    rawData,
    fieldOptions: getFieldOptionsWithGroupByTags(queries, fieldOptions),
    tableOptions,
    colors,
    showCount: parseIfPositiveNumber(templates, graphOptions),
  })

  if (!labels?.length || !datasets?.length) {
    return {summary: null}
  }

  let maxValue = -Infinity
  let maxLabel = ''
  let maxColor: string | undefined

  datasets.forEach(dataset => {
    ;(dataset.data || []).forEach((value, dataIndex) => {
      const numericValue =
        typeof value === 'number' && Number.isFinite(value)
          ? value
          : typeof value === 'object' &&
            value !== null &&
            'y' in value &&
            typeof (value as {y: unknown}).y === 'number' &&
            Number.isFinite((value as {y: number}).y)
          ? (value as {y: number}).y
          : null

      if (numericValue === null || numericValue <= maxValue) {
        return
      }

      maxValue = numericValue
      maxLabel = labels[dataIndex] ?? ''

      const borderColor = dataset.borderColor
      const backgroundColor = dataset.backgroundColor
      maxColor = Array.isArray(borderColor)
        ? borderColor[dataIndex]
        : borderColor ??
          (Array.isArray(backgroundColor)
            ? backgroundColor[dataIndex]
            : backgroundColor)
    })
  })

  if (!Number.isFinite(maxValue)) {
    return {summary: null}
  }

  return {
    summary: {
      context: {
        timeRange: formatTimeRange(timeRange),
        interval: null,
        aggregation: getAggregation(queries),
        summaryType: 'Chart Max',
        showTime: false,
      },
      items: [
        {
          label: maxLabel,
          value: maxValue,
          time: null,
        },
      ],
    },
    itemColor: maxColor,
  }
}

// Build summary + overlay color for a cell, or return null when hidden/unsupported.
export const resolveCellSummaryDisplay = ({
  isShowSummaryOverlay,
  isFluxQuery,
  cellType,
  queries,
  responses,
  timeRange,
  colors,
  fieldOptions,
  tableOptions,
  graphOptions,
  templates,
}: CellSummaryDisplayOptions): {
  summary: CellSummary | null
  itemColor?: string
} => {
  if (
    !isShowSummaryOverlay ||
    !isShowInformationSupported({
      cellType,
      isFluxQuery,
      responses,
      fieldOptions,
    })
  ) {
    return {summary: null}
  }

  const mode = CELL_SUMMARY_CONFIG[cellType] ?? 'hide'
  if (mode === 'hide') {
    return {summary: null}
  }

  if (isStaticGraphType(cellType)) {
    return buildStatisticalSummary({
      cellType,
      queries,
      responses,
      timeRange,
      fieldOptions,
      tableOptions,
      colors,
      graphOptions,
      templates,
    })
  }

  const summary = buildTimeSeriesSummary({queries, responses, timeRange})
  if (!summary?.items[0]) {
    return {summary}
  }

  if (!summary.items[0].chartLabel) {
    return {summary}
  }

  // Match the max series to the chart line color via chartLabel.
  try {
    const transformed = groupByTimeSeriesTransform(responses, false)
    if (!transformed?.sortedLabels?.length) {
      return {summary}
    }

    const idx = transformed.sortedLabels.findIndex(
      label => label.label === summary.items[0].chartLabel
    )
    if (idx < 0) {
      return {summary}
    }

    return {
      summary,
      itemColor: getLineColorsHexes(colors, transformed.sortedLabels.length)[
        idx
      ],
    }
  } catch {
    return {summary}
  }
}
