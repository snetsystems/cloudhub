// Library
import React, {useMemo, useCallback, useState} from 'react'
import {HorizontalAlignment, OuiInMemoryTable} from '@opensearch-project/oui'
import '@opensearch-project/oui/dist/oui_theme_dark.css'

// Components
import ExpandableCell from 'src/log_analysis/components/ExpandableCell'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LoadingDots from 'src/shared/components/LoadingDots'
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'

// Type
import {TimeZones} from 'src/types'

// Util
import {formattedTime} from 'src/log_analysis/util'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

interface SyslogEvent {
  id: string
  timestamp: string
  ip: string
  hostname: string
  message: string
  message_tokens: string[]
  event_original: string
}

// TODO Remove Generating Mocking Function
function generateMockData(count = 60): SyslogEvent[] {
  const hosts = ['host1', 'host2', 'host3']
  const ips = ['192.168.16.1', '10.0.0.5', '172.16.0.3']
  const msgs = [
    'Login attempt with "basic" provider succeeded',
    'Session closed for user root',
    'Exception during resolving address: Host name lookup failure',
    'run-docker-runtime mount: Deactivated successfully',
  ]

  return Array.from({length: count}, (_, i) => {
    const ts = String(Date.now() - i * 45_000)
    const msg = msgs[i % msgs.length]
    const tokens = msg
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
    return {
      id: String(i + 1),
      timestamp: ts,
      ip: ips[i % ips.length],
      hostname: hosts[i % hosts.length],
      message: msg,
      message_tokens: tokens,
      event_original: `<134>${ts} ${
        hosts[i % hosts.length]
      } python[1286]: ${msg}`,
    }
  })
}

interface Props {
  timeZone: TimeZones
}
// TODO Add Search Change Event
function LogAnalysisSyslogTable({timeZone = TimeZones.UTC}: Props) {
  // TODO Remove Mock Data
  const items = useMemo(() => generateMockData(100), [])
  const onSearchChange = useCallback(criteria => {}, [])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const columns = [
    {
      field: 'timestamp',
      name: 'Timestamp',
      dataType: 'date' as const,
      sortable: true,
      width: '10%',
      render: (v: string) => formattedTime(v, timeZone),
    },
    {
      field: 'ip',
      name: 'IP',
      sortable: true,
      width: '10%',
    },
    {
      field: 'hostname',
      name: 'Hostname',
      sortable: true,
      width: '5%',
    },
    {
      field: 'message',
      name: 'Message',
      sortable: true,
      width: '30%',
      render: (v: string) => v,
    },
    {
      field: 'message_tokens',
      name: 'Token Count',
      sortable: true,
      truncateText: true,
      width: '10%',
      align: 'center' as HorizontalAlignment,
      render: (tokens: string[]) => tokens.length,
    },
    {
      field: 'event_original',
      name: 'Raw',
      sortable: true,
      truncateText: true,
      width: '35%',
      render: (v: string) => (
        <ExpandableCell text={v} width="100%" expandedMaxHeight="50px" />
      ),
    },
  ]

  const sorting = {
    sort: {
      field: 'timestamp',
      direction: 'desc' as const,
    },
    allowNeutralSort: true,
  }

  return (
    <>
      <LogAnalysisDashboardHeader
        cellName="Log Analysis Syslog Table"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        {isLoading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
      </LogAnalysisDashboardHeader>

      <FancyScrollbar style={{height: 'calc(100% - 40px)'}}>
        <div className="syslog-table--container">
          <OuiInMemoryTable<SyslogEvent>
            itemId="id"
            items={items}
            columns={columns}
            pagination={{hidePerPageOptions: true}}
            sorting={sorting}
            search={{
              box: {
                incremental: true,
                placeholder: 'Filter your Syslog data',
                style: {
                  width: '98%',
                  background: 'inherit',
                  border: '2px solid #383846',
                  padding: '4px 4px 4px 38px',
                  margin: '5px 0px',
                },
              },
              onChange: onSearchChange,
            }}
          />
        </div>
      </FancyScrollbar>
    </>
  )
}

const areEqual = (prevProps, nextProps) => prevProps === nextProps

export default React.memo(LogAnalysisSyslogTable, areEqual)
