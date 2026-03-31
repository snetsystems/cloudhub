import {TimeSeriesResponse, TimeSeriesValue} from 'src/types/series'

type HostCellValue = TimeSeriesValue | TimeSeriesValue[] | null | undefined

/**
 * URL Monitoring 쿼리 결과는 series.tags의 (host, method, server) 조합으로 분리됩니다.
 * 화면의 1 row는 해당 조합 1개를 기준으로 하며, series.columns(측정 필드/alias)을 컬럼 키에 매핑합니다.
 */
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
            // 사진 기준 "요청/URL"처럼 method + server를 함께 보여줌
            url: `${method} ${server}`,
            // 사진의 "지원"을 host로 표기
            region: host,
          } as Record<string, HostCellValue>)

        const rows = series.values ?? []
        if (!rows.length) {
          rowMap.set(rowKey, row)
          return
        }

        series.columns.forEach((columnName, index) => {
          // series.values 각 row의 0번째는 time
          if (index === 0) return

          const isMultiPoint = rows.length > 1
          if (isMultiPoint) {
            const columnValues = rows.map(valueRow => ({
              time: valueRow[0] ?? null,
              value: valueRow[index] ?? null,
            }))
            setRowValue(row, columnName, columnValues as any)
            return
          }

          const singleRow = rows[0]
          setRowValue(row, columnName, singleRow?.[index] ?? null)
        })

        rowMap.set(rowKey, row)
      })
    })
  })

  return Array.from(rowMap.values())
}

