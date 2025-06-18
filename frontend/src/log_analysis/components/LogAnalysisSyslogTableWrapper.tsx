// Library
import React, {useCallback, useEffect, useState, useRef} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Action
import {
  setFilteredLogForLogAnalysis,
  addLogAnalysisRangeFilterClause,
} from 'src/log_analysis/actions/'

// Type
import {
  BaseElasticSearchData,
  FilteredLogsForLogAnalysis,
  SyslogTableRows,
  TimeZones,
} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

// Constants
import {LOG_ANALYSIS_LOCAL_STORAGE_KEY} from 'src/log_analysis/constants'

// Components
import LogAnalysisSyslogTable from 'src/log_analysis/components/LogAnalysisSyslogTable'

// API
import {fetchSyslogTableData} from 'src/log_analysis/apis'

// Util
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {buildCombinedFilters} from 'src/log_analysis/util'

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
  addLogAnalysisRangeFilterClause?: (
    field: string,
    gte?: string,
    lte?: string,
    format?: string
  ) => void
}

type LogAnalysisSyslogTableProps = LogAnalysisSyslogTableOwnProps & StateProps

function LogAnalysisSyslogTableWrapper({
  manualRefresh,
  timeZone,
  filteredLogsForLogAnalysis = [],
  cloudAutoRefresh,
  cloudTimeRange,
  esSource,
}: LogAnalysisSyslogTableProps) {
  let intervalID: number | null
  const [rows, setRows] = useState<SyslogTableRows[]>([])
  const [totalRowCount, setTotalRowCount] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.pageSize === 'number') {
          return parsed.pageSize
        }
      }
    } catch {
      console.log('Failed to parse pageSize from LocalStorage.')
    }
    return 10
  })
  const [sortColumns, setSortColumns] = useState<
    {id: string; direction: 'asc' | 'desc'}[]
  >(() => {
    try {
      const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
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
  const [isLiveUpdating, setIsLiveUpdating] = useState<boolean>(() => {
    const interval = cloudAutoRefresh?.logAnalysis
    return interval !== undefined && interval !== 0
  })

  const prevAutoRefreshRef = useRef<number | undefined>(
    cloudAutoRefresh?.logAnalysis
  )
  const prevManualRefreshRef = useRef<number>(manualRefresh)
  const sortFirstRunRef = useRef(true)
  const pageIndexFirstRunRef = useRef(true)
  const lastFetchParamsRef = useRef<string>('')
  const didSortRef = useRef(false)
  const isAutoRefreshPageResetRef = useRef(false)

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

  const getSyslogTableData = useCallback(
    async (force: boolean = false) => {
      if (_.isEmpty(esSource)) return

      const key = `${pageIndex}-${pageSize}-${JSON.stringify(sortColumns)}`
      if (!force && key === lastFetchParamsRef.current) return
      lastFetchParamsRef.current = key

      const combinedFilters = buildCombinedFilters(
        filteredLogsForLogAnalysis,
        cloudTimeRange?.logAnalysis
      )

      setIsLoading(true)
      try {
        const {data, total} = await fetchSyslogTableData(
          esSource,
          combinedFilters,
          pageIndex,
          pageSize,
          sortColumns
        )
        setRows(data)
        setTotalRowCount(total)
      } finally {
        setIsLoading(false)
      }
    },
    [
      esSource,
      pageIndex,
      pageSize,
      sortColumns,
      filteredLogsForLogAnalysis,
      cloudTimeRange,
    ]
  )

  useEffect(() => {
    setPageIndex(0)
    getSyslogTableData()
  }, [filteredLogsForLogAnalysis])

  useEffect(() => {
    if (pageIndexFirstRunRef.current) {
      pageIndexFirstRunRef.current = false
      return
    }
    if (didSortRef.current) {
      didSortRef.current = false
      return
    }
    if (isAutoRefreshPageResetRef.current) {
      isAutoRefreshPageResetRef.current = false
      getSyslogTableData(true)
      return
    }
    getSyslogTableData(true)
  }, [pageIndex, getSyslogTableData])

  useEffect(() => {
    getSyslogTableData()
  }, [pageSize, getSyslogTableData])

  useEffect(() => {
    if (sortFirstRunRef.current) {
      sortFirstRunRef.current = false
      return
    }
    getSyslogTableData()
  }, [sortColumns, getSyslogTableData])

  useEffect(() => {
    const prev = prevManualRefreshRef.current
    if (prev !== manualRefresh) {
      setPageIndex(0)
      getSyslogTableData()
    }
    prevManualRefreshRef.current = manualRefresh
  }, [manualRefresh, getSyslogTableData])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        if (!isLiveUpdating) return

        if (pageIndex !== 0) {
          isAutoRefreshPageResetRef.current = true
          setPageIndex(0)
        } else {
          getSyslogTableData(true)
        }
      }, cloudAutoRefresh.logAnalysis)
    }

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [
    cloudAutoRefresh?.logAnalysis,
    esSource,
    isLiveUpdating,
    getSyslogTableData,
  ])

  const onChangeItemsPerPage = (size: number) => {
    setPageIndex(0)
    setPageSize(size)
    try {
      const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) : {}
      localStorage.setItem(
        LOG_ANALYSIS_LOCAL_STORAGE_KEY,
        JSON.stringify({...parsed, pageSize: size})
      )
    } catch {
      console.log('Failed to save pageSize to LocalStorage.')
    }
  }

  const onChangePage = (index: number) => {
    setPageIndex(index)
  }

  const onSort = (cols: {id: string; direction: 'asc' | 'desc'}[]) => {
    setPageIndex(0)
    didSortRef.current = true
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
  addLogAnalysisRangeFilterClause: bindActionCreators(
    addLogAnalysisRangeFilterClause,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(LogAnalysisSyslogTableWrapper)
