import React, {useEffect, useMemo, useState} from 'react'
import {Source, Links} from 'src/types'
import {Page} from 'src/reusable_ui'
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
} from 'src/hosts/constants/serverListColumns'
import {executeQueries} from 'src/shared/apis/query'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {generateForHosts} from 'src/utils/tempVars'
import {TimeSeriesResponse, TimeSeriesValue} from 'src/types/series'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
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
  const columns = useMemo(() => serverListColumns({sourceID: source.id}), [])
  const [tableData, setTableData] = useState<Record<string, TimeSeriesValue>[]>(
    []
  )

  const mergeResultsByHost = (
    results: Array<{value: TimeSeriesResponse | null; error: unknown | null}>
  ) => {
    const rowMap = new Map<string, Record<string, TimeSeriesValue>>()

    const isIPv4 = (value: string): boolean =>
      /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(
        value
      )

    const setRowValue = (
      row: Record<string, TimeSeriesValue>,
      key: string,
      value: TimeSeriesValue
    ) => {
      if (value === null || value === undefined) {
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
            } as Record<string, TimeSeriesValue>)

          const values = series.values?.[0]
          if (!values?.length) {
            rowMap.set(host, row)
            return
          }

          series.columns.forEach((columnName, index) => {
            if (index === 0) {
              return
            }
            setRowValue(row, columnName, values[index])
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

      const querySet = serverListQueries.map(query => ({
        id: query.id,
        text: query.text,
        db: source.telegraf,
      }))

      try {
        const results = await executeQueries(source, querySet, templates)
        if (!isSubscribed) {
          return
        }
        setTableData(mergeResultsByHost(results))

        console.log('tableData', mergeResultsByHost(results))
      } catch (error) {
        console.error('Failed to fetch server list data', error)
        if (isSubscribed) {
          setTableData([])
        }
      }
    }

    fetchTableData()

    return () => {
      isSubscribed = false
    }
  }, [source, cloudTimeRange?.default?.lower, cloudTimeRange?.default?.upper])

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
