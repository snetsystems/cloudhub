// Library
import React, {useState, useEffect, useMemo, useCallback} from 'react'
import {
  OuiDataGrid,
  OuiDataGridSchemaDetector,
  OuiIcon,
} from '@opensearch-project/oui'
import '@opensearch-project/oui/dist/oui_theme_dark.css'
import {connect, useDispatch} from 'react-redux'
import {bindActionCreators} from 'redux'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LoadingDots from 'src/shared/components/LoadingDots'
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import RefreshSpinner from 'src/reusable_ui/components/spinners/RefreshSpinner'
import MessageTokensModal from 'src/log_analysis/components/MessageTokensModal'
import LogAnalysisCellsGraphWrapper from 'src/log_analysis/components/LogAnalysisCellsGraphWrapper'

// Actions
import {
  addLogAnalysisMatchPhraseFilterClause,
  addLogAnalysisRangeFilterClause,
  removeLogAnalysisMatchPhraseFilterClause,
} from 'src/log_analysis/actions'
import {openPanel} from 'src/shared/actions/sidePanel'

// Type
import {
  FilteredLogsForLogAnalysis,
  Source,
  SyslogTableRows,
  TimeZones,
} from 'src/types'

// Util
import {formattedTime} from 'src/log_analysis/util'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {
  LOG_ANALYSIS_LOCAL_STORAGE_KEY,
  LOG_ANALYSIS_SYSLOG_TABLE_PAGE_SIZE_OPTIONS,
  SYSLOG_FACILITY_MAP,
  SYSLOG_SEVERITY_MAP,
} from 'src/log_analysis/constants'

interface Props {
  source: Source
  chunkSize: number
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  isLoading: boolean
  isLiveUpdating: boolean
  syslogTableRows: (SyslogTableRows & {_highlight?: Record<string, string[]>})[]
  timeZone: TimeZones
  autoRefreshNumberValue: number
  totalHitsValue: number
  totalRowCount: number
  pageIndex: number
  pageSize: number
  sortColumns: {id: string; direction: 'asc' | 'desc'}[]
  onChunkSizeChange: (value: number) => void
  onChunkSizeBlur: (value: number) => void
  onChangeLiveUpdatingStatus: () => void
  onChangePage: (index: number) => void
  onChangeItemsPerPage: (size: number) => void
  onSort: (cols: {id: string; direction: 'asc' | 'desc'}[]) => void
  onLoadMore: () => void
  openPanel?: typeof openPanel
  hasMore: boolean
}

function LogAnalysisSyslogTable({
  source,
  filteredLogsForLogAnalysis,
  chunkSize,
  isLiveUpdating,
  isLoading,
  syslogTableRows,
  timeZone = TimeZones.UTC,
  totalHitsValue,
  totalRowCount,
  autoRefreshNumberValue,
  pageIndex,
  pageSize,
  onChunkSizeChange,
  onChunkSizeBlur,
  sortColumns = [],
  onChangeLiveUpdatingStatus,
  onChangePage,
  onChangeItemsPerPage,
  onSort,
  onLoadMore,
  openPanel,
  hasMore,
}: Props) {
  const dispatch = useDispatch()

  const [
    isMessageTokensModalVisible,
    setIsMessageTokensModalVisible,
  ] = useState(false)
  const [messageTokensForModal, setMessageTokensForModal] = useState<string[]>(
    []
  )

  const columns = useMemo(
    () => [
      {
        id: '@timestamp',
        display: 'Timestamp',
        schema: 'datetime',
        isExpandable: false,
      },
      {id: 'host.ip', display: 'Host IP', schema: 'ip', isExpandable: false},
      {
        id: 'host.hostname',
        display: 'Hostname',
        schema: 'string',
        isExpandable: false,
      },
      {
        id: 'timeSeriesGraph',
        display: 'Chart',
        schema: 'string',
        isExpandable: false,
        isSortable: false,
      },
      {id: 'message', display: 'Message', schema: 'string', isExpandable: true},
      {
        id: 'message_tokens',
        display: 'Message Tokens',
        schema: 'string',
        isExpandable: true,
      },
      {
        id: 'event.original',
        display: 'Event Original',
        schema: 'string',
        isExpandable: true,
      },
      {
        id: 'service.type',
        display: 'Service Type',
        schema: 'string',
        isExpandable: false,
      },
      {
        id: 'process.name',
        display: 'Process Name',
        schema: 'string',
        isExpandable: false,
      },
      {
        id: 'process.pid',
        display: 'Process PID',
        schema: 'numeric',
        isExpandable: false,
      },
      {
        id: 'log.syslog.severity.code',
        display: 'Syslog Severity',
        isExpandable: false,
      },
      {
        id: 'log.syslog.priority',
        display: 'Syslog Priority',
        isExpandable: false,
      },
      {
        id: 'log.syslog.facility.code',
        display: 'Syslog Facility',
        isExpandable: false,
      },
    ],
    []
  )

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed.visibleColumns)) {
          return parsed.visibleColumns
        }
      }
    } catch {
      console.log('Failed to parse table state from LocalStorage.')
    }
    return columns.map(col => col.id)
  })

  const [chunkSizeInputValue, setChunkSizeInputValue] = useState<string>(
    String(chunkSize)
  )

  useEffect(() => {
    setChunkSizeInputValue(String(chunkSize))
  }, [chunkSize])

  const isLoadMoreDisabled = isLoading || chunkSizeInputValue.trim() === ''

  const items = useMemo(() => syslogTableRows, [syslogTableRows])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRowCount / pageSize))
    if (pageIndex >= totalPages) {
      onChangePage(totalPages - 1)
    }
  }, [totalRowCount, pageSize, pageIndex, onChangePage])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) : {}
      localStorage.setItem(
        LOG_ANALYSIS_LOCAL_STORAGE_KEY,
        JSON.stringify({
          ...parsed,
          visibleColumns,
          sortColumns,
          pageSize,
        })
      )
    } catch {
      console.log('Failed to save table state to LocalStorage.')
    }
  }, [visibleColumns, sortColumns, pageSize])

  const handleExpandSideBar = () => {
    openPanel({
      panelProps: (
        <LogAnalysisCellsGraphWrapper
          ratio={{
            xNum: 1,
            yNum: 6,
            height: 100,
          }}
          title="Log Analysis Time Series Graph"
          source={source}
          selectedTimeRangeLocalStorageKey="log-analysis-time-series-graph"
        />
      ),
      width: 400,
    })
  }

  const excludedOnClickFields = ['@timestamp']
  const renderCellValue = useCallback(
    ({rowIndex, columnId}) => {
      const indexInPage = rowIndex - pageIndex * pageSize
      const row = items[indexInPage]
      if (!row) return null

      const excludedHighlightFields = [
        '@timestamp',
        'host.ip',
        'process.pid',
        'log.syslog.severity.code',
        'log.syslog.priority',
        'log.syslog.facility.code',
        'message_tokens',
      ]

      if (columnId === 'message_tokens') {
        const tokens = row['message_tokens'] || []
        const highlights = row._highlight?.[columnId] || []
        const matchedPlain = highlights.map(h => h.replace(/<[^>]+>/g, ''))
        const tokenNodes = tokens.reduce<React.ReactNode[]>(
          (acc, token, idx) => {
            if (idx > 0) acc.push(', ')
            const isMatch = matchedPlain.includes(token)
            acc.push(
              isMatch ? (
                <span key={idx} className="logs-analysis-highlight--match">
                  {token}
                </span>
              ) : (
                token
              )
            )
            return acc
          },
          []
        )

        return (
          <span
            style={{cursor: 'pointer'}}
            onClick={() => {
              setMessageTokensForModal(tokens)
              setIsMessageTokensModalVisible(true)
            }}
          >
            {tokenNodes}
          </span>
        )
      }

      if (columnId === 'timeSeriesGraph') {
        return (
          <div className="syslog-table-expand--icon">
            <span onClick={handleExpandSideBar}>
              <OuiIcon type="lineChart" size="l" />
            </span>
          </div>
        )
      }

      const html = row._highlight?.[columnId]?.[0]
      if (html && !excludedHighlightFields.includes(columnId)) {
        return <span dangerouslySetInnerHTML={{__html: html}} />
      }

      let cellContent: React.ReactNode
      switch (columnId) {
        case '@timestamp':
          cellContent = formattedTime(row['@timestamp']?.[0] || null, timeZone)
          break
        case 'host.ip':
          cellContent = row['host.ip']?.[0] || ''
          break
        case 'host.hostname':
          cellContent = row['host.hostname']?.[0] || ''
          break
        case 'message':
          cellContent = row['message']?.[0] || ''
          break
        case 'event.original':
          cellContent = row['event.original']?.[0] || ''
          break
        case 'service.type':
          cellContent = row['service.type']?.[0] || ''
          break
        case 'process.name':
          cellContent = row['process.name']?.[0] || ''
          break
        case 'process.pid':
          cellContent = row['process.pid']?.[0] || ''
          break
        case 'log.syslog.severity.code': {
          const sev = row['log.syslog.severity.code']?.[0]
          cellContent =
            sev == null ? '' : SYSLOG_SEVERITY_MAP[sev] || String(sev)
          break
        }
        case 'log.syslog.facility.code': {
          const fac = row['log.syslog.facility.code']?.[0]
          cellContent =
            fac == null ? '' : SYSLOG_FACILITY_MAP[fac] || String(fac)
          break
        }
        case 'log.syslog.priority': {
          const pri = row['log.syslog.priority']?.[0]
          if (pri == null) {
            cellContent = ''
          } else {
            const facFromPri = Math.floor(pri / 8)
            const sevFromPri = pri % 8
            const facText =
              SYSLOG_FACILITY_MAP[facFromPri] || String(facFromPri)
            const sevText =
              SYSLOG_SEVERITY_MAP[sevFromPri] || String(sevFromPri)
            cellContent = `${pri} (${facText} / ${sevText})`
          }
          break
        }
        default:
          cellContent = null
      }

      const rawValue = (row as any)[columnId]
      const filterValue =
        Array.isArray(rawValue) && rawValue.length > 0
          ? rawValue[0]
          : rawValue ?? ''

      return (
        <span
          style={{
            cursor: excludedOnClickFields.includes(columnId)
              ? 'default'
              : 'pointer',
          }}
          onClick={
            excludedOnClickFields.includes(columnId)
              ? undefined
              : () =>
                  dispatch(
                    addLogAnalysisMatchPhraseFilterClause(columnId, filterValue)
                  )
          }
        >
          {cellContent}
        </span>
      )
    },
    [items, timeZone, pageIndex, pageSize, dispatch]
  )

  const ipSchema: OuiDataGridSchemaDetector = {
    type: 'ip',
    icon: 'dot',
    detector: v =>
      /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(
        String(v)
      )
        ? 1
        : 0,
    comparator: (a, b, direction) => {
      const toNum = (ip: string) =>
        ip.split('.').reduce((acc, oct) => acc * 256 + Number(oct), 0)
      const cmp = toNum(a) === toNum(b) ? 0 : toNum(a) > toNum(b) ? 1 : -1
      return direction === 'asc' ? (cmp as -1 | 0 | 1) : (-cmp as -1 | 0 | 1)
    },
    sortTextAsc: 'Low-High',
    sortTextDesc: 'High-Low',
  }
  const shouldAutoRefresh =
    autoRefreshNumberValue !== undefined && autoRefreshNumberValue !== 0
  const totalPages = Math.max(1, Math.ceil(totalRowCount / pageSize))
  const isLastPage = pageIndex === totalPages - 1

  const gridHeight = `${syslogTableRows.length * 35 + 150}px`

  return (
    <>
      <LogAnalysisDashboardHeader
        cellName={
          <div
            className={`livestatus-wrapper ${
              shouldAutoRefresh ? '' : 'disabled'
            } flex`}
            onClick={shouldAutoRefresh ? onChangeLiveUpdatingStatus : undefined}
          >
            Log Analysis Syslog Table
            <RefreshSpinner
              isActive={isLoading || (shouldAutoRefresh && isLiveUpdating)}
              isHighlighted={!!autoRefreshNumberValue && isLiveUpdating}
            />
          </div>
        }
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        {isLoading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
      </LogAnalysisDashboardHeader>

      <FancyScrollbar style={{height: 'calc(100% - 80px)'}}>
        <div className="syslog-table--container">
          <div className="syslog-table--total-count">
            Documents ({totalHitsValue})
          </div>
          <OuiDataGrid
            key={pageSize}
            aria-label="Client-side paginated syslog data grid"
            columns={columns}
            columnVisibility={{visibleColumns, setVisibleColumns}}
            rowCount={totalRowCount}
            renderCellValue={renderCellValue}
            schemaDetectors={[ipSchema]}
            sorting={{columns: sortColumns, onSort}}
            pagination={{
              pageIndex,
              pageSize,
              pageSizeOptions: LOG_ANALYSIS_SYSLOG_TABLE_PAGE_SIZE_OPTIONS,
              onChangePage,
              onChangeItemsPerPage,
            }}
            toolbarVisibility={{
              showColumnSelector: true,
              showSortSelector: true,
              showStyleSelector: false,
              showFullScreenSelector: false,
            }}
            gridStyle={{
              border: 'all',
              fontSize: 'm',
              cellPadding: 'm',
              stripes: true,
              rowHover: 'highlight',
              header: 'underline',
            }}
            height={gridHeight}
          />
        </div>
        {isLastPage && hasMore && (
          <div className="syslog-table-chunksize--container">
            <span>
              {totalRowCount === 1
                ? `Search Result is limited to ${totalRowCount} document.`
                : `Search Results are limited to ${totalRowCount} documents.`}
            </span>
            <div className="syslog-table-chunksize--inner">
              <span
                onClick={isLoadMoreDisabled ? undefined : onLoadMore}
                style={{
                  paddingLeft: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  color: '#1BA9F5',
                  opacity: isLoading ? 0.5 : 1,
                  textDecoration: isLoading ? undefined : 'underline',
                }}
              >
                {isLoading ? 'Loading ' : 'Load More Chunk Size:'}
              </span>
              <input
                id="chunkSizeInput"
                type="number"
                className="form-control input-sm"
                placeholder="Chunk Size"
                aria-label="Chunk Size"
                value={chunkSizeInputValue}
                onChange={e => {
                  const v = e.target.value
                  setChunkSizeInputValue(v)
                  if (v.trim() !== '') {
                    const num = parseInt(v, 10)
                    onChunkSizeChange(isNaN(num) ? 1 : num)
                  }
                }}
                onBlur={() => {
                  if (
                    chunkSizeInputValue.trim() === '' ||
                    isNaN(Number(chunkSizeInputValue))
                  ) {
                    setChunkSizeInputValue('1')
                    onChunkSizeBlur(1)
                  } else {
                    const num = Number(chunkSizeInputValue)
                    onChunkSizeBlur(num)
                  }
                }}
                min={1}
              />
            </div>
          </div>
        )}
      </FancyScrollbar>

      {isMessageTokensModalVisible && (
        <MessageTokensModal
          isVisible={isMessageTokensModalVisible}
          tokens={messageTokensForModal}
          onClose={() => setIsMessageTokensModalVisible(false)}
          onConfirm={selectedTokens => {
            selectedTokens.forEach(token => {
              dispatch(
                addLogAnalysisMatchPhraseFilterClause('message_tokens', token)
              )
            })
            messageTokensForModal
              .filter(token => !selectedTokens.includes(token))
              .forEach(token => {
                const exists = filteredLogsForLogAnalysis.some(
                  clause =>
                    'match_phrase' in clause &&
                    clause.match_phrase['message_tokens'] === token
                )
                if (exists) {
                  dispatch(
                    removeLogAnalysisMatchPhraseFilterClause(
                      'message_tokens',
                      token
                    )
                  )
                }
              })
            setIsMessageTokensModalVisible(false)
          }}
        />
      )}
    </>
  )
}

const mstp = state => {
  const {
    logAnalysisDashboard: {filteredLogsForLogAnalysis},
  } = state
  return {
    filteredLogsForLogAnalysis,
  }
}

const mdtp = dispatch => ({
  openPanel: bindActionCreators(openPanel, dispatch),
  addLogAnalysisRangeFilterClause: bindActionCreators(
    addLogAnalysisRangeFilterClause,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(LogAnalysisSyslogTable)
