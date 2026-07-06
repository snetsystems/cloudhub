import React, {useEffect, useMemo, useRef, useState} from 'react'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {HubbleFlowFilters, HubbleFlowRecord} from 'src/hubble/types'

type ColumnId =
  | 'timestamp'
  | 'verdict'
  | 'trafficDirection'
  | 'sourcePod'
  | 'sourceIp'
  | 'sourceIdentity'
  | 'sourcePort'
  | 'destinationPod'
  | 'destinationIp'
  | 'destinationIdentity'
  | 'destinationPort'
  | 'l7'
  | 'tcpFlags'

interface ColumnDef {
  id: ColumnId
  label: string
  defaultOn: boolean
  render: (f: HubbleFlowRecord) => React.ReactNode
  className?: string
}

// Column catalog: keep Hubble UI's column set so operators familiar with
// `hubble observe` / Hubble UI don't have to re-learn what's available.
const COLUMNS: ColumnDef[] = [
  {
    id: 'timestamp',
    label: 'Timestamp',
    defaultOn: true,
    render: f => formatTimestamp(f.time),
    className: 'is-mono',
  },
  {
    id: 'verdict',
    label: 'Verdict',
    defaultOn: true,
    render: f => (
      <span className={verdictClass(f.verdict)}>{f.verdict.toLowerCase()}</span>
    ),
  },
  {
    id: 'trafficDirection',
    label: 'Traffic Direction',
    defaultOn: false,
    render: f => f.trafficDirection?.toLowerCase() ?? '—',
  },
  {
    id: 'sourcePod',
    label: 'Source Pod',
    defaultOn: true,
    render: f => f.srcPod || f.srcWorkload || '—',
    className: 'is-mono',
  },
  {
    id: 'sourceIp',
    label: 'Source IP',
    defaultOn: false,
    render: f => f.srcIp ?? '—',
    className: 'is-mono',
  },
  {
    id: 'sourceIdentity',
    label: 'Source Identity',
    defaultOn: false,
    render: f => (f.srcIdentity ? String(f.srcIdentity) : '—'),
    className: 'is-mono',
  },
  {
    id: 'sourcePort',
    label: 'Source Port',
    defaultOn: false,
    render: f =>
      f.srcPort ? `${f.srcPort}${f.protocol ? ` ${f.protocol}` : ''}` : '—',
    className: 'is-mono',
  },
  {
    id: 'destinationPod',
    label: 'Destination Pod',
    defaultOn: true,
    render: f => f.dstPod || f.dstWorkload || '—',
    className: 'is-mono',
  },
  {
    id: 'destinationIp',
    label: 'Destination IP',
    defaultOn: false,
    render: f => f.dstIp ?? '—',
    className: 'is-mono',
  },
  {
    id: 'destinationIdentity',
    label: 'Destination Identity',
    defaultOn: false,
    render: f => (f.dstIdentity ? String(f.dstIdentity) : '—'),
    className: 'is-mono',
  },
  {
    id: 'destinationPort',
    label: 'Destination Port',
    defaultOn: true,
    render: f =>
      f.dstPort ? `${f.dstPort}${f.protocol ? ` ${f.protocol}` : ''}` : '—',
    className: 'is-mono',
  },
  {
    id: 'l7',
    label: 'L7 info',
    defaultOn: true,
    render: f => f.l7 ?? '—',
    className: 'is-mono',
  },
  {
    id: 'tcpFlags',
    label: 'TCP Flags',
    defaultOn: false,
    render: f => (f.tcpFlags && f.tcpFlags.length ? f.tcpFlags.join(' ') : '—'),
    className: 'is-mono',
  },
]

const STORAGE_KEY = 'hubble.flowTable.columns.v1'

const loadColumns = (): Record<ColumnId, boolean> => {
  const defaults = COLUMNS.reduce(
    (acc, c) => ({...acc, [c.id]: c.defaultOn}),
    {} as Record<ColumnId, boolean>
  )
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>
    return {...defaults, ...parsed}
  } catch {
    return defaults
  }
}

interface Props {
  flows: HubbleFlowRecord[]
  connected: boolean
  loading: boolean
  error: string
  filters: HubbleFlowFilters
  onFiltersChange: (filters: HubbleFlowFilters) => void
  onSelectFlow?: (flow: HubbleFlowRecord) => void
}

const FlowTable: React.FC<Props> = ({
  flows,
  connected,
  loading,
  error,
  filters,
  onFiltersChange,
  onSelectFlow,
}) => {
  const [visible, setVisible] = useState<Record<ColumnId, boolean>>(() =>
    loadColumns()
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(visible))
    } catch {
      // localStorage may be disabled — non-fatal
    }
  }, [visible])

  // Close the column picker when clicking outside.
  useEffect(() => {
    if (!pickerOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!pickerRef.current) return
      if (!pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [pickerOpen])

  const activeColumns = useMemo(() => COLUMNS.filter(c => visible[c.id]), [
    visible,
  ])

  const updateFilter = (
    key: keyof HubbleFlowFilters,
    value: string | boolean
  ) => {
    onFiltersChange({...filters, [key]: value})
  }

  const hasFilters = hasActiveFilters(filters)

  return (
    <div className="hubble-flow-table">
      <div className="hubble-flow-table-header">
        <span className="hubble-flow-table-title">
          Flows
          <span className="hubble-flow-table-count">
            {flows.length} {loading ? '(loading…)' : ''}
          </span>
          <span
            className={`hubble-flow-table-status ${
              connected ? 'is-ok' : 'is-bad'
            }`}
          >
            {connected ? 'live' : 'reconnecting'}
          </span>
        </span>
        <div className="hubble-flow-table-actions">
          <div className="hubble-column-picker" ref={pickerRef}>
            <button
              type="button"
              className="hubble-column-picker-trigger"
              onClick={() => setPickerOpen(o => !o)}
              aria-expanded={pickerOpen}
            >
              Columns ▾
            </button>
            {pickerOpen && (
              <div className="hubble-column-picker-menu" role="menu">
                {COLUMNS.map(c => (
                  <label key={c.id} className="hubble-column-picker-item">
                    <input
                      type="checkbox"
                      checked={!!visible[c.id]}
                      onChange={e => {
                        const checked = e.currentTarget.checked
                        setVisible(prev => ({...prev, [c.id]: checked}))
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="hubble-flow-filter-bar">
        <input
          className="hubble-flow-filter-input hubble-flow-filter-input--wide"
          value={filters.q || ''}
          onChange={e => updateFilter('q', e.target.value)}
          placeholder="Search flows"
          aria-label="Search flows"
        />
        <input
          className="hubble-flow-filter-input"
          value={filters.srcWorkload || ''}
          onChange={e => updateFilter('srcWorkload', e.target.value)}
          placeholder="Source workload"
          aria-label="Source workload filter"
        />
        <input
          className="hubble-flow-filter-input"
          value={filters.dstWorkload || ''}
          onChange={e => updateFilter('dstWorkload', e.target.value)}
          placeholder="Destination workload"
          aria-label="Destination workload filter"
        />
        <select
          className="hubble-flow-filter-select"
          value={filters.verdict || ''}
          onChange={e => updateFilter('verdict', e.target.value)}
          aria-label="Verdict filter"
        >
          <option value="">Any verdict</option>
          <option value="FORWARDED">Forwarded</option>
          <option value="DROPPED">Dropped</option>
          <option value="ERROR">Error</option>
          <option value="AUDIT">Audit</option>
        </select>
        <input
          className="hubble-flow-filter-input"
          value={filters.dropReason || ''}
          onChange={e => updateFilter('dropReason', e.target.value)}
          placeholder="Drop reason"
          aria-label="Drop reason filter"
        />
        <input
          className="hubble-flow-filter-input hubble-flow-filter-input--port"
          value={filters.port || ''}
          onChange={e => updateFilter('port', e.target.value)}
          placeholder="Src/Dst port"
          inputMode="numeric"
          aria-label="Source or destination port filter"
        />
        <select
          className="hubble-flow-filter-select"
          value={filters.protocol || ''}
          onChange={e => updateFilter('protocol', e.target.value)}
          aria-label="Protocol filter"
        >
          <option value="">Any protocol</option>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="SCTP">SCTP</option>
        </select>
        <select
          className="hubble-flow-filter-select"
          value={filters.l7Type || ''}
          onChange={e => updateFilter('l7Type', e.target.value)}
          aria-label="L7 filter"
        >
          <option value="">Any L7</option>
          <option value="HTTP">HTTP</option>
          <option value="DNS">DNS</option>
          <option value="Kafka">Kafka</option>
        </select>
        <input
          className="hubble-flow-filter-input"
          value={filters.l7Query || ''}
          onChange={e => updateFilter('l7Query', e.target.value)}
          placeholder="L7 query"
          aria-label="L7 query filter"
        />
        <label className="hubble-flow-filter-checkbox">
          <input
            type="checkbox"
            checked={!!filters.externalOnly}
            onChange={e => updateFilter('externalOnly', e.target.checked)}
          />
          External
        </label>
        <button
          type="button"
          className="hubble-flow-filter-clear"
          onClick={() => onFiltersChange({})}
          disabled={!hasFilters}
        >
          Clear
        </button>
      </div>
      <div className="hubble-flow-table-body">
        <FancyScrollbar autoHide={true} className="hubble-flow-table-scroll">
          {error && <div className="hubble-flow-table-error">{error}</div>}
          {!error && flows.length === 0 && !loading && (
            <div className="hubble-flow-table-empty">
              아직 수집된 flow가 없습니다. (트래픽이 흐르면 표시됩니다)
            </div>
          )}
          {flows.length > 0 && (
            <table>
              <thead>
                <tr>
                  {activeColumns.map(c => (
                    <th key={c.id}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flows.map((f, i) => (
                  <tr
                    key={i}
                    onClick={() => onSelectFlow && onSelectFlow(f)}
                    className="hubble-flow-table-row"
                    title="클릭해서 전체 디테일 보기"
                  >
                    {activeColumns.map(c => (
                      <td key={c.id} className={c.className}>
                        {c.render(f)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </FancyScrollbar>
      </div>
    </div>
  )
}

const hasActiveFilters = (filters: HubbleFlowFilters): boolean =>
  !!(
    filters.srcWorkload ||
    filters.dstWorkload ||
    filters.verdict ||
    filters.dropReason ||
    filters.protocol ||
    filters.port ||
    filters.l7Type ||
    filters.l7Query ||
    filters.externalOnly ||
    filters.q
  )

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  // Format: 2026/06/22 15:45:17 (compact, like Hubble UI bottom table)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const verdictClass = (verdict: string): string => {
  switch (verdict) {
    case 'FORWARDED':
      return 'hubble-verdict-forwarded'
    case 'DROPPED':
      return 'hubble-verdict-dropped'
    case 'ERROR':
    case 'AUDIT':
      return 'hubble-verdict-error'
    default:
      return ''
  }
}

export default FlowTable
