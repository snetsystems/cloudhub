import {
  TableLineChartPoint,
  TimeSeriesResponse,
  TimeSeriesValue,
} from 'src/types/series'

type HostCellValue =
  | TimeSeriesValue
  | TimeSeriesValue[]
  | TableLineChartPoint[]
  | null
  | undefined

export const toNumericPoint = (value: TimeSeriesValue | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const isTableLineChartPoint = (
  value: unknown
): value is TableLineChartPoint =>
  !!value &&
  typeof value === 'object' &&
  'time' in value &&
  'value' in value

export const toLineValues = (
  value: HostCellValue
): TableLineChartPoint[] => {
  if (Array.isArray(value)) {
    const lineValues = value as Array<TimeSeriesValue | TableLineChartPoint>
    const tablePoints = lineValues.filter(isTableLineChartPoint)

    if (tablePoints.length === lineValues.length) {
      return tablePoints.map(item => ({
        time: item.time ?? null,
        value: toNumericPoint(item.value),
      }))
    }

    return lineValues.map((item, index) => ({
      time: index,
      value: toNumericPoint(item as TimeSeriesValue),
    }))
  }

  return value === null || value === undefined
    ? []
    : [{time: 0, value: toNumericPoint(value)}]
}

export const mergeResultsByHost = (
  results: Array<{value: TimeSeriesResponse | null; error: unknown | null}>
) => {
  const rowMap = new Map<string, Record<string, HostCellValue>>()

  const isIPv4 = (value: string): boolean =>
    /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(
      value
    )

  const setRowValue = (
    row: Record<string, HostCellValue>,
    key: string,
    value: HostCellValue
  ) => {
    if (value === null || value === undefined) {
      return
    }
    if (Array.isArray(value) && value.length === 0) {
      return
    }

    const currentValue = row[key]

    if (typeof value === 'number' && typeof currentValue === 'number') {
      row[key] = Math.max(currentValue, value)
      return
    }

    row[key] = value
  }

  results.forEach(result => {
    const response = result?.value
    if (!response?.results) {
      return
    }

    response.results.forEach(statement => {
      if (!('series' in statement) || !statement.series?.length) {
        return
      }

      statement.series.forEach(series => {
        const host = series.tags?.host
        if (!host) {
          return
        }

        const row =
          rowMap.get(host) ||
          ({
            host,
            ip: isIPv4(host) ? host : '-',
          } as Record<string, HostCellValue>)

        const rows = series.values ?? []
        if (!rows.length) {
          rowMap.set(host, row)
          return
        }

        series.columns.forEach((columnName, index) => {
          if (index === 0) {
            return
          }
          const isMultiPoint = rows.length > 1
          if (isMultiPoint) {
            const columnValues = rows.map(valueRow => ({
              time: valueRow[0] ?? null,
              value: valueRow[index] ?? null,
            }))
            setRowValue(row, columnName, columnValues)
            return
          }

          const singleRow = rows[0]
          setRowValue(row, columnName, singleRow?.[index] ?? null)
        })

        rowMap.set(host, row)
      })
    })
  })

  return Array.from(rowMap.values())
}
