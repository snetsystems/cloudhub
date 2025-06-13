// Library
import React, {useState, useEffect, useMemo, useCallback} from 'react'
import {
  OuiDataGrid,
  OuiDataGridSchemaDetector,
  OuiSearchBar,
} from '@opensearch-project/oui'
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
  LOG_ANALYSIS_CELLS_COLUMNS,
  LOG_ANALYSIS_SYSLOG_TABLE_PAGE_SIZE_OPTIONS,
  SYSLOG_FACILITY_MAP,
  SYSLOG_SEVERITY_MAP,
} from 'src/log_analysis/constants'

interface Props {
  isLoading: boolean
  isLiveUpdating: boolean
  syslogTableRows: SyslogTableRows[]
  timeZone: TimeZones
  autoRefreshNumberValue: number
  totalRowCount: number
  pageIndex: number
  pageSize: number
  sortColumns: {id: string; direction: 'asc' | 'desc'}[]
  onChangeLiveUpdatingStatus: () => void
  onChangePage: (index: number) => void
  onChangeItemsPerPage: (size: number) => void
  onSort: (cols: {id: string; direction: 'asc' | 'desc'}[]) => void
}

function LogAnalysisSyslogTable({
  isLiveUpdating,
  isLoading,
  syslogTableRows,
  timeZone = TimeZones.UTC,
  totalRowCount,
  autoRefreshNumberValue,
  pageIndex,
  pageSize,
  sortColumns = [],
  onChangeLiveUpdatingStatus,
  onChangePage,
  onChangeItemsPerPage,
  onSort,
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
        display: 'Token Count',
        schema: 'numeric',
        isExpandable: false,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOG_ANALYSIS_CELLS_COLUMNS)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (
          parsed &&
          Array.isArray(parsed.visibleColumns) &&
          parsed.visibleColumns.every((c: any) => typeof c === 'string')
        ) {
          return parsed.visibleColumns
        }
      }
    } catch {
      console.log('Failed to parse table state from LocalStorage.')
    }
    return columns.map(col => col.id)
  })

  const items = useMemo(() => syslogTableRows, [syslogTableRows])
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    const lower = searchQuery.toLowerCase()
    return items.filter(row => {
      const fields = [
        row['@timestamp']?.[0] || '',
        row['host.ip']?.[0] || '',
        row['host.hostname']?.[0] || '',
        row['message']?.[0] || '',
        (row['message_tokens']?.length || '').toString(),
        row['event.original']?.[0] || '',
        row['service.type']?.[0] || '',
        row['process.name']?.[0] || '',
        (row['process.pid']?.[0] || '').toString(),
        (row['log.syslog.severity.code']?.[0] || '').toString(),
        (row['log.syslog.priority']?.[0] || '').toString(),
        (row['log.syslog.facility.code']?.[0] || '').toString(),
      ]
      const tokens = row['message_tokens'] || []
      return (
        fields.some(f => f.toLowerCase().includes(lower)) ||
        tokens.some(t => t.includes(lower))
      )
    })
  }, [items, searchQuery])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRowCount / pageSize))
    if (pageIndex >= totalPages) onChangePage(totalPages - 1)
  }, [totalRowCount, pageSize, pageIndex, onChangePage])

  useEffect(() => {
    try {
      localStorage.setItem(
        LOG_ANALYSIS_CELLS_COLUMNS,
        JSON.stringify({visibleColumns, sortColumns})
      )
    } catch {
      console.log('Failed to save table state to LocalStorage.')
    }
  }, [visibleColumns, sortColumns])

  const onSearchChange = useCallback(({query, error}) => {
    if (!error && query.text !== undefined) setSearchQuery(query.text)
  }, [])

  const renderCellValue = useCallback(
    ({rowIndex, columnId}) => {
      const indexInPage = rowIndex - pageIndex * pageSize
      const row = filteredItems[indexInPage]
      if (!row) return null
      switch (columnId) {
        case '@timestamp':
          return formattedTime(row['@timestamp']?.[0] || null, timeZone)
        case 'host.ip':
          return row['host.ip']?.[0] || ''
        case 'host.hostname':
          return row['host.hostname']?.[0] || ''
        case 'message':
          return row['message']?.[0] || ''
        case 'message_tokens':
          return row['message_tokens']?.length || 0
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
          if (sev == null) return ''
          return SYSLOG_SEVERITY_MAP[sev] || String(sev)
        }
        case 'log.syslog.facility.code': {
          const fac = row['log.syslog.facility.code']?.[0]
          if (fac == null) return ''
          return SYSLOG_FACILITY_MAP[fac] || String(fac)
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

  return (
    <>
      <LogAnalysisDashboardHeader
        cellName="Log Analysis Syslog Table"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        customNamenode={
          <div
            className={`livestatus-wrapper ${
              shouldAutoRefresh ? '' : 'disabled'
            }`}
            onClick={shouldAutoRefresh ? onChangeLiveUpdatingStatus : undefined}
          >
            <RefreshSpinner
              isActive={isLoading || (shouldAutoRefresh && isLiveUpdating)}
              isHighlighted={!!autoRefreshNumberValue && isLiveUpdating}
            />
          </div>
        }
      >
        {isLoading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
      </LogAnalysisDashboardHeader>

      <FancyScrollbar style={{height: 'calc(100% - 40px)'}}>
        <div className="syslog-table--container">
          <OuiSearchBar
            query={searchQuery}
            onChange={onSearchChange}
            box={{
              incremental: true,
              placeholder: 'Filter your Syslog data',
              style: {background: 'inherit'},
            }}
          />

          <OuiDataGrid
            aria-label="Server-side paginated syslog data grid"
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
      </FancyScrollbar>
    </>
  )
}

const areEqual = (prevProps: Props, nextProps: Props) => prevProps === nextProps

export default React.memo(LogAnalysisSyslogTable, areEqual)
