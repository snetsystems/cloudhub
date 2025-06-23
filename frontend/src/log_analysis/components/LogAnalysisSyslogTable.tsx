// Library
import React, {useState, useEffect, useMemo, useCallback} from 'react'
import {OuiDataGrid, OuiDataGridSchemaDetector} from '@opensearch-project/oui'
import '@opensearch-project/oui/dist/oui_theme_dark.css'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LoadingDots from 'src/shared/components/LoadingDots'
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import RefreshSpinner from 'src/reusable_ui/components/spinners/RefreshSpinner'

// Type
import {SyslogTableRows, TimeZones} from 'src/types'

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
  onChangeLiveUpdatingStatus: () => void
  onChangePage: (index: number) => void
  onChangeItemsPerPage: (size: number) => void
  onSort: (cols: {id: string; direction: 'asc' | 'desc'}[]) => void
  onLoadMore: () => void
  hasMore: boolean
}

function LogAnalysisSyslogTable({
  isLiveUpdating,
  isLoading,
  syslogTableRows,
  timeZone = TimeZones.UTC,
  totalHitsValue,
  totalRowCount,
  autoRefreshNumberValue,
  pageIndex,
  pageSize,
  sortColumns = [],
  onChangeLiveUpdatingStatus,
  onChangePage,
  onChangeItemsPerPage,
  onSort,
  onLoadMore,
  hasMore,
}: Props) {
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

  const items = useMemo(() => syslogTableRows, [syslogTableRows])
  const [searchQuery, setSearchQuery] = useState('')
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    const lower = searchQuery.toLowerCase()
    return items.filter(row =>
      Object.values(row)
        .flat()
        .some(val => String(val).toLowerCase().includes(lower))
    )
  }, [items, searchQuery])

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
  const renderCellValue = useCallback(
    ({rowIndex, columnId}) => {
      const indexInPage = rowIndex - pageIndex * pageSize
      const row = filteredItems[indexInPage]
      if (!row) return null

      const excluded = [
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
        return tokens.reduce<React.ReactNode[]>((acc, token, idx) => {
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
        }, [])
      }

      const html = row._highlight?.[columnId]?.[0]
      if (html && !excluded.includes(columnId)) {
        return <span dangerouslySetInnerHTML={{__html: html}} />
      }

      switch (columnId) {
        case '@timestamp':
          return formattedTime(row['@timestamp']?.[0] || null, timeZone)
        case 'host.ip':
          return row['host.ip']?.[0] || ''
        case 'host.hostname':
          return row['host.hostname']?.[0] || ''
        case 'message':
          return row['message']?.[0] || ''
        case 'event.original':
          return row['event.original']?.[0] || ''
        case 'service.type':
          return row['service.type']?.[0] || ''
        case 'process.name':
          return row['process.name']?.[0] || ''
        case 'process.pid':
          return row['process.pid']?.[0] || ''
        case 'log.syslog.severity.code': {
          const sev = row['log.syslog.severity.code']?.[0]
          return sev == null ? '' : SYSLOG_SEVERITY_MAP[sev] || String(sev)
        }
        case 'log.syslog.facility.code': {
          const fac = row['log.syslog.facility.code']?.[0]
          return fac == null ? '' : SYSLOG_FACILITY_MAP[fac] || String(fac)
        }
        case 'log.syslog.priority': {
          const pri = row['log.syslog.priority']?.[0]
          if (pri == null) return ''
          const facFromPri = Math.floor(pri / 8)
          const sevFromPri = pri % 8
          const facText = SYSLOG_FACILITY_MAP[facFromPri] || String(facFromPri)
          const sevText = SYSLOG_SEVERITY_MAP[sevFromPri] || String(sevFromPri)
          return `${pri} (${facText} / ${sevText})`
        }
        default:
          return null
      }
    },
    [filteredItems, timeZone, pageIndex, pageSize]
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
          />
        </div>
        {isLastPage && hasMore && (
          <div style={{padding: '8px', textAlign: 'center'}}>
            <span>
              Search results are limited to {totalRowCount} documents.
            </span>
            <span
              onClick={isLoading ? undefined : onLoadMore}
              style={{
                paddingLeft: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                color: '#1BA9F5',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? 'Loading' : 'Load More'}
            </span>
          </div>
        )}
      </FancyScrollbar>
    </>
  )
}

const areEqual = (prevProps: Props, nextProps: Props) => prevProps === nextProps

export default React.memo(LogAnalysisSyslogTable, areEqual)
