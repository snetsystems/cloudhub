// Library
import React, {useCallback, useEffect, useState, useRef} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Action
import {setFilteredLogForLogAnalysis} from 'src/log_analysis/actions/'

// Type
import {
  BaseElasticSearchData,
  FilteredLogsForLogAnalysis,
  SyslogTableRows,
  TimeZones,
} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

// Constants
import {LOG_ANALYSIS_CELLS_COLUMNS} from 'src/log_analysis/constants'

// Components
import LogAnalysisSyslogTable from 'src/log_analysis/components/LogAnalysisSyslogTable'

// API
import {fetchSyslogTableData} from 'src/log_analysis/apis'

// Util
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

interface LogAnalysisSyslogTableOwnProps {
  timeZone?: TimeZones
}

interface StateProps {
  manualRefresh: number
  cloudAutoRefresh?: CloudAutoRefresh
  cloudTimeRange?: CloudTimeRange
  esSource?: BaseElasticSearchData
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  setFilteredLogForLogAnalysis?: (
    filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
  ) => void
}

type LogAnalysisSyslogTableProps = LogAnalysisSyslogTableOwnProps & StateProps

function LogAnalysisSyslogTableWrapper({
  manualRefresh,
  timeZone,
  filteredLogsForLogAnalysis,
  cloudAutoRefresh,
  esSource,
  setFilteredLogForLogAnalysis,
}: LogAnalysisSyslogTableProps) {
  let intervalID
  const [rows, setRows] = useState<SyslogTableRows[]>([])
  const [totalRowCount, setTotalRowCount] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortColumns, setSortColumns] = useState<
    {id: string; direction: 'asc' | 'desc'}[]
  >(() => {
    try {
      const stored = localStorage.getItem(LOG_ANALYSIS_CELLS_COLUMNS)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (
          parsed &&
          Array.isArray(parsed.sortColumns) &&
          parsed.sortColumns.every(
            (c: any) =>
              c &&
              typeof c.id === 'string' &&
              (c.direction === 'asc' || c.direction === 'desc')
          )
        ) {
          return parsed.sortColumns
        }
      }
    } catch {
      console.log('Failed to parse sortColumns from LocalStorage.')
    }
    return [{id: '@timestamp', direction: 'desc'}]
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isLiveUpdating, setIsLiveUpdating] = useState<boolean>(true)

  const prevAutoRefreshRef = useRef<number | undefined>(
    cloudAutoRefresh?.logAnalysis
  )
  const prevManualRefreshRef = useRef<number>(manualRefresh)

  useEffect(() => {
    const prev = prevAutoRefreshRef.current
    const current = cloudAutoRefresh?.logAnalysis
    if (prev === 0 && current && current !== 0) {
      setIsLiveUpdating(true)
    } else if (prev && prev !== 0 && current === 0) {
      setIsLiveUpdating(false)
    }
    prevAutoRefreshRef.current = current
  }, [cloudAutoRefresh?.logAnalysis])

  const getSyslogTableData = useCallback(async () => {
    if (!isLiveUpdating || _.isEmpty(esSource)) return

    setIsLoading(true)
    try {
      const {data, total} = await fetchSyslogTableData(
        esSource,
        '2025-05-30T08:16:03.312Z',
        new Date().toISOString(),
        pageIndex,
        pageSize,
        sortColumns
      )
      setRows(data)
      setTotalRowCount(total)
    } finally {
      setIsLoading(false)
    }
  }, [esSource, pageIndex, pageSize, sortColumns, isLiveUpdating])

  useEffect(() => {
    const prev = prevManualRefreshRef.current
    if (prev !== manualRefresh) {
      setPageIndex(0)
      getSyslogTableData()
    }
    prevManualRefreshRef.current = manualRefresh
  }, [manualRefresh])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        if (!isLiveUpdating) return

        setPageIndex(0)
        getSyslogTableData()
      }, cloudAutoRefresh.logAnalysis)
    }

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh?.logAnalysis, esSource, isLiveUpdating])

  useEffect(() => {
    setPageIndex(0)
    getSyslogTableData()
  }, [sortColumns])

  const onChangeItemsPerPage = size => {
    setPageIndex(0)
    setPageSize(size)
    getSyslogTableData()
  }

  const onChangePage = index => {
    setPageIndex(index)
    getSyslogTableData()
  }

  const onSort = cols => {
    setPageIndex(0)
    setSortColumns(cols)
  }

  const onChangeLiveUpdatingStatus = () => setIsLiveUpdating(prev => !prev)

  return (
    <LogAnalysisSyslogTable
      autoRefreshNumberValue={cloudAutoRefresh?.logAnalysis}
      isLoading={isLoading}
      syslogTableRows={rows}
      timeZone={timeZone}
      totalRowCount={totalRowCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      sortColumns={sortColumns}
      isLiveUpdating={isLiveUpdating}
      onChangePage={onChangePage}
      onChangeItemsPerPage={onChangeItemsPerPage}
      onSort={onSort}
      onChangeLiveUpdatingStatus={onChangeLiveUpdatingStatus}
    />
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {timeZone, cloudAutoRefresh, cloudTimeRange, esSource},
    },
    logAnalysisDashboard: {filteredLogsForLogAnalysis},
  } = state
  return {
    timeZone,
    cloudAutoRefresh,
    cloudTimeRange,
    esSource,
    filteredLogsForLogAnalysis,
  }
}

const mdtp = dispatch => ({
  setFilteredLogForLogAnalysis: bindActionCreators(
    setFilteredLogForLogAnalysis,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(LogAnalysisSyslogTableWrapper)
