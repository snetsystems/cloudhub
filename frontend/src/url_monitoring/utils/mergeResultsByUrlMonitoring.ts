import {TimeSeriesResponse, TimeSeriesValue} from 'src/types/series'

type HostCellValue = TimeSeriesValue | TimeSeriesValue[] | null | undefined

function canonicalUrlMonitoringColumnKey(columnName: string): string {
  if (columnName === 'last_response_time') return 'response_time_ms'
  return columnName
}

export const mergeResultsByUrlMonitoring = (
  results: Array<{value: TimeSeriesResponse | null; error: unknown | null}>
) => {
  const rowMap = new Map<string, Record<string, HostCellValue>>()

  const setRowValue = (
    row: Record<string, HostCellValue>,
    key: string,
    value: HostCellValue
  ) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value) && value.length === 0) return

    const currentValue = row[key]
    if (typeof value === 'number' && typeof currentValue === 'number') {
      row[key] = Math.max(currentValue, value)
      return
    }
    row[key] = value
  }

  results.forEach(result => {
    const response = result?.value
    if (!response?.results) return

    response.results.forEach(statement => {
      if (!('series' in statement) || !statement.series?.length) return

      statement.series.forEach(series => {
        const host = series.tags?.host
        const method = series.tags?.method
        const server = series.tags?.server

        if (!host || !method || !server) return

        const rowKey = `${host}|||${method}|||${server}`
        const row =
          rowMap.get(rowKey) ||
          ({
            host,
            method,
            server,
            // Request/URL column: show method + server together
            url: `${method} ${server}`,
            // "Support" column maps to host
            region: host,
          } as Record<string, HostCellValue>)

        const rows = series.values ?? []
        if (!rows.length) {
          rowMap.set(rowKey, row)
          return
        }

        series.columns.forEach((columnName, index) => {
          // First column in each series.values row is time
          if (index === 0) return

          const key = canonicalUrlMonitoringColumnKey(columnName)
          const isMultiPoint = rows.length > 1
          if (isMultiPoint) {
            const columnValues = rows.map(valueRow => ({
              time: valueRow[0] ?? null,
              value: valueRow[index] ?? null,
            }))
            setRowValue(row, key, columnValues as any)
            return
          }

          const singleRow = rows[0]
          setRowValue(row, key, singleRow?.[index] ?? null)
        })

        rowMap.set(rowKey, row)
      })
    })
  })

  return Array.from(rowMap.values())
}
