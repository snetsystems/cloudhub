import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Source, Links} from 'src/types'
import {Page} from 'src/reusable_ui'
import {ButtonShape, Radio} from 'src/reusable_ui'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import TableComponent from 'src/device_management/components/TableComponent'
import {
  serverListColumns,
  serverListQueries,
  serverListLineQueries,
} from 'src/hosts/constants/serverListColumns'
import {executeQueries} from 'src/shared/apis/query'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {generateForHosts} from 'src/utils/tempVars'
import {TimeSeriesResponse, TimeSeriesValue} from 'src/types/series'
type HostCellValue = TimeSeriesValue | TimeSeriesValue[]

interface Props {
  source: Source
  links: Links
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  inPresentationMode: boolean
}
function NewHostsPage({
  source,
  cloudAutoRefresh: _cloudAutoRefresh,
  cloudTimeRange,
  inPresentationMode: _inPresentationMode,
}: Props) {
  const [displayedChartMode, setDisplayedChartMode] = useState<
    'gauge' | 'line'
  >('gauge')
  const [pendingChartMode, setPendingChartMode] = useState<'gauge' | 'line'>(
    'gauge'
  )
  const [isModeSwitching, setIsModeSwitching] = useState(false)
  const requestIdRef = useRef(0)
  const columns = useMemo(
    () =>
      serverListColumns({sourceID: source.id, chartMode: displayedChartMode}),
    [source.id, displayedChartMode]
  )
  const [tableData, setTableData] = useState<Record<string, HostCellValue>[]>(
    []
  )

  const mergeResultsByHost = (
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
              const columnValues = rows.map(valueRow => valueRow[index] ?? null)
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

  useEffect(() => {
    let isSubscribed = true

    const fetchTableData = async () => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      const shouldSwitchMode = pendingChartMode !== displayedChartMode
      if (shouldSwitchMode) {
        setIsModeSwitching(true)
      }

      const selectedTimeRange = cloudTimeRange?.default || {
        lower: 'now() - 1h',
        upper: 'now()',
      }

      const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
        selectedTimeRange
      )
      const templates = [
        ...generateForHosts(source),
        dashboardTime,
        upperDashboardTime,
      ]

      const selectedQueries =
        pendingChartMode === 'line' ? serverListLineQueries : serverListQueries

      const querySet = selectedQueries.map(query => ({
        id: query.id,
        text: query.text,
        db: source.telegraf,
      }))

      try {
        const results = await executeQueries(source, querySet, templates)
        if (!isSubscribed || requestId !== requestIdRef.current) {
          return
        }
        const mergedData = mergeResultsByHost(results)
        setTableData(mergedData)
        if (shouldSwitchMode) {
          setDisplayedChartMode(pendingChartMode)
        }
        setIsModeSwitching(false)

        console.log('tableData', mergedData)
      } catch (error) {
        console.error('Failed to fetch server list data', error)
        if (isSubscribed && requestId === requestIdRef.current) {
          if (!shouldSwitchMode) {
            setTableData([])
          }
          setIsModeSwitching(false)
        }
      }
    }

    fetchTableData()

    return () => {
      isSubscribed = false
    }
  }, [
    source,
    displayedChartMode,
    pendingChartMode,
    cloudTimeRange?.default?.lower,
    cloudTimeRange?.default?.upper,
  ])

  return (
    <Page className="hosts-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Hosts" />
        </Page.Header.Left>
        <Page.Header.Right></Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <div className="host-page-graph-table-container-wrapper">
          <div className="host-page-graph-table-container table-gauge-chart">
            {columns.length > 0 && tableData.length > 0 && (
              <TableComponent
                data={tableData || []}
                columns={columns}
                isSearchDisplay={true}
                isDotKey={true}
              />
            )}
          </div>
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <Radio shape={ButtonShape.Default}>
              <Radio.Button
                id="host-chart-mode-gauge"
                titleText="Gauge"
                value="gauge"
                active={displayedChartMode === 'gauge'}
                onClick={() => {
                  if (pendingChartMode !== 'gauge' && !isModeSwitching) {
                    setPendingChartMode('gauge')
                  }
                }}
              >
                Gauge
              </Radio.Button>
              <Radio.Button
                id="host-chart-mode-line"
                titleText="Line"
                value="line"
                active={displayedChartMode === 'line'}
                onClick={() => {
                  if (pendingChartMode !== 'line' && !isModeSwitching) {
                    setPendingChartMode('line')
                  }
                }}
              >
                Line
              </Radio.Button>
            </Radio>
          </div>
        </div>
      </Page.Contents>
    </Page>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh, cloudTimeRange},
      ephemeral: {inPresentationMode},
    },
    links,
  } = state
  return {
    links,
    cloudTimeRange,
    cloudAutoRefresh,
    inPresentationMode,
  }
}

const mdtp = dispatch => ({
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp)(NewHostsPage)
