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
import LiveUpdatingStatus from 'src/logs/components/LiveUpdatingStatus'

// Type
import {HitFields, TimeZones} from 'src/types'

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

interface Row extends HitFields {
  id: string
}

function generateMockData(): Row[] {
  return [
    {
      id: '1',
      '@timestamp': ['2025-05-28T01:15:44.000Z'],
      'host.ip': ['192.168.16.1'],
      'host.hostname': ['host1'],
      message: [
        '[2025-05-28T01:15:44.828+00:00][INFO ][plugins.security.authentication] Login attempt with "basic" provider succeeded (requires redirect: true).\n',
      ],
      message_tokens: [
        '2025-05-28t01:15:44.828+00:00',
        'info',
        'plugins.security.authentication',
        'login',
        'attempt',
        'basic',
        'provider',
        'succeeded',
        'requires',
        'redirect',
        'true',
        '.',
      ],
      'event.original': [
        '<142>2025-05-28T10:15:44+09:00 host1 kibana[1181]: [2025-05-28T01:15:44.828+00:00][INFO ][plugins.security.authentication] Login attempt with "basic" provider succeeded (requires redirect: true).\n',
      ],
      'service.type': ['system'],
      'process.name': ['kibana'],
      'process.pid': [1181],
      'log.syslog.severity.code': [6],
      'log.syslog.priority': [142],
      'log.syslog.facility.code': [17],
    },
    {
      id: '2',
      '@timestamp': ['2025-05-28T01:15:43.000Z'],
      'host.ip': ['192.168.16.1'],
      'host.hostname': ['host1'],
      message: [
        '[2025-05-28T01:15:43.716+00:00][INFO ][plugins.security.authentication] Performing login attempt with "basic" provider.\n',
      ],
      message_tokens: [
        '2025-05-28t01:15:43.716+00:00',
        'info',
        'plugins.security.authentication',
        'performing',
        'login',
        'attempt',
        'basic',
        'provider.',
      ],
      'event.original': [
        '<142>2025-05-28T10:15:43+09:00 host1 kibana[1181]: [2025-05-28T01:15:43.716+00:00][INFO ][plugins.security.authentication] Performing login attempt with "basic" provider.\n',
      ],
      'service.type': ['system'],
      'process.name': ['kibana'],
      'process.pid': [1181],
      'log.syslog.severity.code': [6],
      'log.syslog.priority': [142],
      'log.syslog.facility.code': [17],
    },
    {
      id: '3',
      '@timestamp': ['2025-05-28T01:15:30.046Z'],
      'host.ip': ['192.168.16.1'],
      'host.hostname': ['host1'],
      message: [
        'run-docker-runtime\\x2drunc-moby-ebba8de10c493727e9865a1ccacedc604a3feed32b411220fcd183140ee2e635-runc.4YKCW2.mount: Deactivated successfully.\n',
      ],
      message_tokens: [
        'run-docker-runtime-runc-moby-ebba8de10c493727e9865a1ccacedc604a3feed32b411220fcd183140ee2e635-runc.4ykcw2.mount',
        'deactivated',
        'successfully.',
      ],
      'event.original': [
        '<30>2025-05-28T10:15:30.046014+09:00 host1 systemd[1]: run-docker-runtime\\x2drunc-moby-ebba8de10c493727e9865a1ccacedc604a3feed32b411220fcd183140ee2e635-runc.4YKCW2.mount: Deactivated successfully.\n',
      ],
      'service.type': ['system'],
      'process.name': ['systemd'],
      'process.pid': [1],
      'log.syslog.severity.code': [6],
      'log.syslog.priority': [30],
      'log.syslog.facility.code': [3],
    },
  ]
}

interface Props {
  timeZone?: TimeZones
}

function LogAnalysisSyslogTable({timeZone = TimeZones.UTC}: Props) {
  const columns = useMemo(
    () => [
      {
        id: '@timestamp',
        display: 'Timestamp',
        schema: 'datetime',
        isExpandable: false,
      },
      {
        id: 'host.ip',
        display: 'Host IP',
        schema: 'ip',
        isExpandable: false,
      },
      {
        id: 'host.hostname',
        display: 'Hostname',
        isExpandable: false,
      },
      {
        id: 'message',
        display: 'Message',
        isExpandable: true,
      },
      {
        id: 'message_tokens',
        display: 'Token Count',
        schema: 'numeric',
        isExpandable: false,
      },
      {
        id: 'event.original',
        display: 'Event Original',
        isExpandable: true,
      },
      {
        id: 'service.type',
        display: 'Service Type',
        isExpandable: false,
      },
      {
        id: 'process.name',
        display: 'Process Name',
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

  const defaultVisible = columns.map(col => col.id)
  const defaultSort = [{id: '@timestamp', direction: 'desc'}]

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [isLiveUpdating, setIsLiveUpdating] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(false)
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
    return defaultVisible
  })
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
            (s: any) =>
              s != null &&
              typeof s === 'object' &&
              typeof s.id === 'string' &&
              (s.direction === 'asc' || s.direction === 'desc')
          )
        ) {
          return parsed.sortColumns
        }
      }
    } catch {
      console.log('Failed to parse table state from LocalStorage.')
    }
    return defaultSort
  })

  const items = useMemo(() => generateMockData(), [])
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    const lowerCased = searchQuery.toLowerCase()
    return items.filter(row => {
      const checks = [
        row['@timestamp']?.[0]?.toLowerCase() || '',
        row['host.ip']?.[0]?.toLowerCase() || '',
        row['host.hostname']?.[0]?.toLowerCase() || '',
        row['message']?.[0]?.toLowerCase() || '',
        row['message_tokens']?.length?.toString() || '',
        row['event.original']?.[0]?.toLowerCase() || '',
        row['service.type']?.[0]?.toLowerCase() || '',
        row['process.name']?.[0]?.toLowerCase() || '',
        row['process.pid']?.[0]?.toString().toLowerCase() || '',
        row['log.syslog.severity.code']?.[0]?.toString().toLowerCase() || '',
        row['log.syslog.priority']?.[0]?.toString().toLowerCase() || '',
        row['log.syslog.facility.code']?.[0]?.toString().toLowerCase() || '',
      ]
      const tokens = row['message_tokens'] || []
      return (
        checks.some(field => field.includes(lowerCased)) ||
        tokens.some(token => token.includes(lowerCased))
      )
    })
  }, [items, searchQuery])

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredItems.length / pagination.pageSize)
    )
    if (pagination.pageIndex >= totalPages) {
      setPagination(prev => ({...prev, pageIndex: totalPages - 1}))
    }
  }, [filteredItems.length, pagination.pageSize, pagination.pageIndex])

  useEffect(() => {
    try {
      const toStore = {visibleColumns, sortColumns}
      localStorage.setItem(LOG_ANALYSIS_CELLS_COLUMNS, JSON.stringify(toStore))
    } catch {
      console.log('Failed to save table state to LocalStorage.')
    }
  }, [visibleColumns, sortColumns])

  const onSearchChange = useCallback(({query, error}) => {
    if (!error && query.text !== undefined) {
      setSearchQuery(query.text)
    }
  }, [])

  const onChangePage = useCallback(
    (pageIndex: number) => setPagination(prev => ({...prev, pageIndex})),
    []
  )

  const onChangeItemsPerPage = useCallback(
    (pageSize: number) =>
      setPagination(prev => ({
        ...prev,
        pageIndex: 0,
        pageSize,
      })),
    []
  )

  const onSort = useCallback(
    (newSortColumns: {id: string; direction: 'asc' | 'desc'}[]) => {
      setSortColumns(newSortColumns)
    },
    []
  )

  const renderCellValue = useCallback(
    ({rowIndex, columnId}: {rowIndex: number; columnId: string}) => {
      const row = filteredItems[rowIndex]

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
    [filteredItems, timeZone]
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

  const handleChangeLiveUpdatingStatus = () => {
    setIsLiveUpdating(!isLiveUpdating)
  }

  return (
    <>
      <LogAnalysisDashboardHeader
        cellName="Log Analysis Syslog Table"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        customNamenode={
          <div id="log-analysis--livestatus">
            <LiveUpdatingStatus
              onChangeLiveUpdatingStatus={handleChangeLiveUpdatingStatus}
              liveUpdating={isLiveUpdating}
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
              style: {
                background: 'inherit',
              },
            }}
          />

          <OuiDataGrid
            aria-label="In-memory syslog data grid"
            columns={columns}
            columnVisibility={{
              visibleColumns: visibleColumns,
              setVisibleColumns: setVisibleColumns,
            }}
            rowCount={filteredItems.length}
            renderCellValue={renderCellValue}
            schemaDetectors={[ipSchema]}
            inMemory={{level: 'sorting'}}
            sorting={{
              columns: sortColumns as {id: string; direction: 'asc' | 'desc'}[],
              onSort,
            }}
            pagination={{
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
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
