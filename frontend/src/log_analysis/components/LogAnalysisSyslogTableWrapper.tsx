import React, {useCallback, useEffect, useState, useRef, useMemo} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'
import debounce from 'lodash/debounce'

// Action
import {
  setFilteredLogForLogAnalysis,
  addLogAnalysisRangeFilterClause,
  setSelectedDevice,
} from 'src/log_analysis/actions/'
import {openPanel} from 'src/shared/actions/sidePanel'
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Type
import {
  BaseElasticSearchData,
  DeviceType,
  FilteredLogsForLogAnalysis,
  Source,
  SyslogTableRows,
  TimeZones,
  Notification,
  Me,
  DeviceMeta,
  TimeRange,
} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

// Constants
import {
  DEFAULT_SYSLOG_TABLE_CHUNK_SIZE,
  LOG_ANALYSIS_LOCAL_STORAGE_KEY,
} from 'src/log_analysis/constants'

// Components
import LogAnalysisSyslogTable from 'src/log_analysis/components/LogAnalysisSyslogTable'
import LogAnalysisCellsGraphWrapper from 'src/log_analysis/components/LogAnalysisCellsGraphWrapper'

// API
import {fetchSyslogTableData} from 'src/log_analysis/apis'
import {ensureDeviceMapping} from 'src/admin/apis/deviceMapping'

// Utils
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {buildCombinedFilters} from 'src/log_analysis/util'
import {
  notifyFetchDeviceMappingFailed,
  notifyFetchSyslogTableDataFailed,
} from 'src/shared/copy/notifications'
import {ADMIN_ROLE, isUserAuthorized} from 'src/auth/Authorized'

interface LogAnalysisSyslogTableOwnProps {
  timeZone?: TimeZones
}

interface Auth {
  me: Me
}

interface StateProps {
  source: Source
  auth?: Auth
  logAnalysisManualRefresh?: number
  cloudAutoRefresh?: CloudAutoRefresh
  cloudTimeRange?: CloudTimeRange
  esSource?: BaseElasticSearchData
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  openPanel?: typeof openPanel
  setSelectedDevice?: typeof setSelectedDevice
  notify?: (message: Notification) => void
}

type LogAnalysisSyslogTableProps = LogAnalysisSyslogTableOwnProps & StateProps

function LogAnalysisSyslogTableWrapper({
  source,
  auth,
  logAnalysisManualRefresh,
  timeZone,
  filteredLogsForLogAnalysis = [],
  cloudAutoRefresh,
  cloudTimeRange,
  esSource,
  openPanel,
  setSelectedDevice,
  notify,
}: LogAnalysisSyslogTableProps) {
  const [syslogTableChunkSize, setSyslogTableChunkSize] = useState<number>(
    () => {
      try {
        const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (typeof parsed.chunkSize === 'number') {
            return parsed.chunkSize
          }
        }
      } catch {
        console.log('Failed to parse chunkSize from LocalStorage.')
      }
      return DEFAULT_SYSLOG_TABLE_CHUNK_SIZE
    }
  )
  const syslogTableChunkSizeRef = useRef(syslogTableChunkSize)
  useEffect(() => {
    syslogTableChunkSizeRef.current = syslogTableChunkSize
  }, [syslogTableChunkSize])

  let intervalID: number | null = null

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
  const prevManualRefreshRef = useRef<number>(logAnalysisManualRefresh)
  const sortFirstRunRef = useRef(true)
  const prevFiltersRef = useRef<FilteredLogsForLogAnalysis>(
    filteredLogsForLogAnalysis
  )
  const filterFirstRunRef = useRef(true)
  const prevSortValuesRef = useRef<any>(null)

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
    async (reset: boolean = false) => {
      if (_.isEmpty(esSource)) return
      const combinedFilters = buildCombinedFilters(
        filteredLogsForLogAnalysis,
        cloudTimeRange?.logAnalysis
      )
      setIsLoading(true)
      try {
        const chunkSizeParam = reset
          ? DEFAULT_SYSLOG_TABLE_CHUNK_SIZE
          : syslogTableChunkSizeRef.current
        const {data, total, lastSortValues} = await fetchSyslogTableData(
          esSource,
          combinedFilters,
          chunkSizeParam,
          sortColumns,
          reset ? undefined : prevSortValuesRef.current
        )
        setTotalRowCount(total)
        if (reset) setRows(data)
        else setRows(prev => [...prev, ...data])
        if (lastSortValues) prevSortValuesRef.current = lastSortValues
      } catch (error) {
        notify(notifyFetchSyslogTableDataFailed(error.message))

        setTotalRowCount(0)
        if (reset) setRows([])
      } finally {
        setIsLoading(false)
      }
    },

    [esSource, sortColumns, filteredLogsForLogAnalysis, cloudTimeRange, notify]
  )

  const debouncedGetSyslogTableData = useMemo(
    () => debounce((reset: boolean) => getSyslogTableData(reset), 250),
    [getSyslogTableData]
  )

  useEffect(() => {
    return () => {
      debouncedGetSyslogTableData.cancel()
    }
  }, [debouncedGetSyslogTableData])

  useEffect(() => {
    const prev = prevManualRefreshRef.current
    if (prev !== logAnalysisManualRefresh) {
      setPageIndex(0)
      debouncedGetSyslogTableData(true)
    }
    prevManualRefreshRef.current = logAnalysisManualRefresh
  }, [logAnalysisManualRefresh, debouncedGetSyslogTableData])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        if (!isLiveUpdating) return
        setPageIndex(0)
        debouncedGetSyslogTableData(true)
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
    debouncedGetSyslogTableData,
  ])

  useEffect(() => {
    if (sortFirstRunRef.current) {
      sortFirstRunRef.current = false
      return
    }
    setPageIndex(0)
    debouncedGetSyslogTableData(true)
  }, [sortColumns, debouncedGetSyslogTableData])

  useEffect(() => {
    if (filterFirstRunRef.current) {
      filterFirstRunRef.current = false
      setPageIndex(0)
      debouncedGetSyslogTableData(true)
      return
    }
    if (_.isEqual(prevFiltersRef.current, filteredLogsForLogAnalysis)) {
      return
    }
    prevFiltersRef.current = filteredLogsForLogAnalysis
    setPageIndex(0)
    debouncedGetSyslogTableData(true)
  }, [filteredLogsForLogAnalysis, debouncedGetSyslogTableData])

  const onChangePage = (index: number) => setPageIndex(index)
  const onChangeItemsPerPage = (size: number) => {
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
  const onLoadMore = () => debouncedGetSyslogTableData(false)
  const onSort = (cols: {id: string; direction: 'asc' | 'desc'}[]) =>
    setSortColumns(cols)
  const onChangeLiveUpdatingStatus = () => setIsLiveUpdating(prev => !prev)

  const getDeviceMapping = async (
    hostname: string,
    deviceType: DeviceType
  ): Promise<DeviceMeta> => {
    try {
      const deviceMapping = await ensureDeviceMapping(hostname, esSource?.id)

      return deviceMapping
    } catch (error: any) {
      notify(notifyFetchDeviceMappingFailed(error.message || ''))

      return {
        ip: '',
        hostname,
        aliasName: '',
        deviceType: deviceType,
        orgId: '',
        isDeletable: false,
        appName: '',
      } as DeviceMeta
    }
  }

  const handleExpandSideBar = useCallback(
    async (
      hostname: string,
      deviceType: DeviceType,
      logTimeRange: TimeRange
    ) => {
      const deviceMeta = await getDeviceMapping(hostname, deviceType)

      setSelectedDevice(deviceMeta)
      openPanel({
        panelProps: ((
          <LogAnalysisCellsGraphWrapper
            ratio={{
              xNum: 1,
              yNum: 6,
              height: 100,
            }}
            title="Time Series Graph"
            source={source}
            selectedTimeRangeLocalStorageKey="log-analysis-time-series-graph"
            isAuthorized={isUserAuthorized(
              _.get(auth, 'me.role', ''),
              ADMIN_ROLE
            )}
            logTimeRange={logTimeRange}
          />
        ) as unknown) as React.ReactElement,
      })
    },
    [source, openPanel, setSelectedDevice]
  )

  return (
    <LogAnalysisSyslogTable
      handleExpandSideBar={handleExpandSideBar}
      chunkSize={syslogTableChunkSize}
      onChunkSizeChange={value => {
        setSyslogTableChunkSize(value)
        try {
          const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
          const parsed = stored ? JSON.parse(stored) : {}
          localStorage.setItem(
            LOG_ANALYSIS_LOCAL_STORAGE_KEY,
            JSON.stringify({...parsed, chunkSize: value})
          )
        } catch {
          console.log('Failed to save Chunk Size to LocalStorage.')
        }
      }}
      onChunkSizeBlur={value => {
        const finalValue = isNaN(value)
          ? DEFAULT_SYSLOG_TABLE_CHUNK_SIZE
          : value
        setSyslogTableChunkSize(finalValue)
        try {
          const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
          const parsed = stored ? JSON.parse(stored) : {}
          localStorage.setItem(
            LOG_ANALYSIS_LOCAL_STORAGE_KEY,
            JSON.stringify({...parsed, chunkSize: finalValue})
          )
        } catch {
          console.log('Failed to save Chunk Size to LocalStorage.')
        }
      }}
      autoRefreshNumberValue={cloudAutoRefresh?.logAnalysis}
      isLoading={isLoading}
      syslogTableRows={rows.slice(
        pageIndex * pageSize,
        (pageIndex + 1) * pageSize
      )}
      timeZone={timeZone}
      totalHitsValue={totalRowCount}
      totalRowCount={rows.length}
      pageIndex={pageIndex}
      pageSize={pageSize}
      sortColumns={sortColumns}
      isLiveUpdating={isLiveUpdating}
      onChangePage={onChangePage}
      onChangeItemsPerPage={onChangeItemsPerPage}
      onSort={onSort}
      onLoadMore={onLoadMore}
      hasMore={rows.length < totalRowCount}
      onChangeLiveUpdatingStatus={onChangeLiveUpdatingStatus}
    />
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {timeZone, cloudAutoRefresh, cloudTimeRange, esSource},
    },
    logAnalysisDashboard: {
      filteredLogsForLogAnalysis,
      logAnalysisManualRefresh,
    },
    auth,
  } = state
  return {
    timeZone,
    cloudAutoRefresh,
    cloudTimeRange,
    esSource,
    filteredLogsForLogAnalysis,
    logAnalysisManualRefresh,
    auth,
  }
}

const mdtp = dispatch => ({
  openPanel: bindActionCreators(openPanel, dispatch),
  setFilteredLogForLogAnalysis: bindActionCreators(
    setFilteredLogForLogAnalysis,
    dispatch
  ),
  addLogAnalysisRangeFilterClause: bindActionCreators(
    addLogAnalysisRangeFilterClause,
    dispatch
  ),
  setSelectedDevice: bindActionCreators(setSelectedDevice, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(LogAnalysisSyslogTableWrapper)
