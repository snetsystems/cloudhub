import classnames from 'classnames'
import moment from 'moment'
import React, {useEffect, useMemo, useState} from 'react'
import {
  DEFAULT_TABLE_OPTIONS,
  DEFAULT_FIELD_OPTIONS,
  DEFAULT_DECIMAL_PLACES,
} from 'src/dashboards/constants'
import {
  DEFAULT_AXES,
  AXES_SCALE_OPTIONS,
} from 'src/dashboards/constants/cellEditor'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'
import {executeQueries} from 'src/shared/apis/query'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {generateForHosts} from 'src/utils/tempVars'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LoadingDots from 'src/shared/components/LoadingDots'
import RefreshingGraph from 'src/shared/components/RefreshingGraph'
import {
  DEFAULT_TABLE_GAUGE_CHART_OPTIONS,
  DEFAULT_GRAPH_OPTIONS,
} from 'src/shared/constants'
import {LINE_COLOR_PALETTES_SEQUENCE} from 'src/shared/constants/graphColorPalettes'
import {
  buildUrlMonitoringLatencyChartQuery,
  buildUrlMonitoringRawSamplesQuery,
} from 'src/url_monitoring/constants/urlMonitoringDetailQuery'
import {
  formatBodyLength,
  formatDetailReason,
  parseUrlMonitoringRawSamples,
  UrlMonitoringRawSampleRow,
} from 'src/url_monitoring/utils/parseUrlMonitoringRawSamples'
import {CellType, QueryType} from 'src/types'
import type {CellQuery, Template} from 'src/types'
import {DataTableObject, Notification, Source, TimeZones} from 'src/types'
import type {Axes} from 'src/types/dashboards'
import type {GraphOptions} from 'src/types/dashboards'
import {NoteVisibility} from 'src/types/dashboards'
import {TimeRange} from 'src/types/queries'

const URL_LATENCY_DETAIL_CHART_COLORS = LINE_COLOR_PALETTES_SEQUENCE[0]

/** Same visual defaults as ProcessDetailModal `PROCESS_DETAIL_CHART_OPTIONS` */
const URL_LATENCY_DETAIL_CHART_OPTIONS = {
  graphOptions: {
    ...DEFAULT_GRAPH_OPTIONS,
    fillArea: false,
    showLine: true,
    showPoint: false,
  } as GraphOptions,
  decimalPlaces: {...DEFAULT_DECIMAL_PLACES, digits: 2, isEnforced: true},
  staticLegend: false,
  axisLabelWidth: 56,
  /** Must match `.dygraph-child-container` top in `urlMonitoring.scss` so MaxMarker/Crosshair offsets stay aligned. */
  containerStyle: {
    left: 2,
    top: 24,
    width: 'calc(100% - 4px)',
    height: 'calc(100% - 4px)',
    position: 'absolute' as const,
  },
}

/** Same as ProcessDetailModal `PROCESS_axes` with y lower bound 0; y-axis title hidden in SCSS */
const URL_LATENCY_DETAIL_AXES: Axes = {
  ...DEFAULT_AXES,
  y: {
    ...DEFAULT_AXES.y,
    suffix: '',
    base: AXES_SCALE_OPTIONS.BASE_RAW,
    bounds: ['0', ''],
  },
}

function statusBadgeColor(code: number | null): string {
  if (code === null) return '#6b7280'
  if (code >= 200 && code < 300) return '#4ed8a0'
  if (code >= 300 && code < 400) return '#63b3ff'
  if (code >= 400) return '#ff4d4f'
  return '#6b7280'
}

function formatSampleTime(
  t: string | number | null,
  timeZone: TimeZones
): string {
  if (t === null || t === undefined) return '--'
  const parsed = timeZone === TimeZones.UTC ? moment.utc(t) : moment(t)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : String(t)
}

export interface URLMonitoringLatencyDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  row: DataTableObject | null
  source: Source
  urlMonitoringTimeRange: TimeRange | undefined
  timeZone: TimeZones
  notify: (n: Notification) => void
  chartManualRefresh?: number
}

export function URLMonitoringLatencyDetailSheet({
  isOpen,
  onClose,
  row,
  source,
  urlMonitoringTimeRange,
  timeZone,
  notify,
  chartManualRefresh = 0,
}: URLMonitoringLatencyDetailSheetProps) {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)
  const [loading, setLoading] = useState(false)
  const [detailRows, setDetailRows] = useState<UrlMonitoringRawSampleRow[]>([])

  const timeRangeKey = useMemo(
    () =>
      `${urlMonitoringTimeRange?.lower ?? ''}|${
        urlMonitoringTimeRange?.upper ?? ''
      }`,
    [urlMonitoringTimeRange?.lower, urlMonitoringTimeRange?.upper]
  )

  const selectedTimeRange = useMemo(
    () => urlMonitoringTimeRange ?? CLOUD_TIME_RANGE.urlMonitoring,
    [urlMonitoringTimeRange]
  )

  const graphTemplates: Template[] = useMemo(() => {
    const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
      selectedTimeRange
    )
    return [...generateForHosts(source), dashboardTime, upperDashboardTime]
  }, [source, selectedTimeRange])

  const chartCellId = useMemo(() => {
    if (!row?.host || !row?.method || !row?.server) {
      return 'url-monitoring-latency-detail-chart'
    }
    const key = `${row.host}|${row.method}|${row.server}`
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
    return `url-mon-latency-${safe}`
  }, [row?.host, row?.method, row?.server])

  const latencyChartQueries: CellQuery[] = useMemo(() => {
    if (!row?.host || !row?.method || !row?.server) return []
    const text = buildUrlMonitoringLatencyChartQuery(
      String(row.host),
      String(row.method),
      String(row.server)
    )
    return [
      {
        query: text,
        text,
        id: 'url-monitoring-latency-detail-chart',
        type: QueryType.InfluxQL,
        queryConfig: null as CellQuery['queryConfig'],
        source: source.id,
      },
    ]
  }, [row?.host, row?.method, row?.server, source.id])

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }
    setIsVisible(false)
    const t = window.setTimeout(() => setIsMounted(false), 250)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !row?.host || !row?.method || !row?.server) {
      setDetailRows([])
      setLoading(false)
      return
    }

    const host = String(row.host)
    const method = String(row.method)
    const server = String(row.server)

    let cancelled = false
    setLoading(true)
    setDetailRows([])

    const run = async () => {
      try {
        const selected =
          urlMonitoringTimeRange ?? CLOUD_TIME_RANGE.urlMonitoring
        const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
          selected
        )
        const templates = [
          ...generateForHosts(source),
          dashboardTime,
          upperDashboardTime,
        ]
        const text = buildUrlMonitoringRawSamplesQuery(host, method, server)
        const [result] = await executeQueries(
          source,
          [
            {
              id: 'url-monitoring-raw-samples',
              text,
              db: source.telegraf,
            },
          ],
          templates
        )
        if (cancelled) return
        if (result.error) {
          throw result.error
        }
        setDetailRows(parseUrlMonitoringRawSamples(result.value))
      } catch (e: unknown) {
        if (!cancelled) {
          notify({
            type: 'error',
            icon: 'alert-triangle',
            duration: 10000,
            isHasHTML: false,
            message: `Failed to load URL check history: ${
              e instanceof Error ? e.message : String(e)
            }`,
          })
          setDetailRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    row?.host,
    row?.method,
    row?.server,
    source,
    timeRangeKey,
    urlMonitoringTimeRange,
    notify,
  ])

  if (!isMounted || !row) return null

  const title = String(row.name ?? row.url ?? 'Response time')
  const subtitle = String(row.url ?? `${row.method ?? ''} ${row.server ?? ''}`)

  return (
    <>
      <div
        className={classnames('modal-wrapper', {
          'modal-wrapper--open': isVisible,
          'modal-wrapper--closing': !isVisible,
        })}
        onClick={onClose}
        role="presentation"
      />
      <div
        className={classnames(
          'modal-content url-monitoring-latency-detail-sheet',
          isVisible ? 'modal-content--open' : 'modal-content--closing'
        )}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="url-monitoring-latency-detail-title"
      >
        <div className="url-monitoring-latency-detail-sheet__header">
          <div className="url-monitoring-latency-detail-sheet__header-left">
            <div className="url-monitoring-latency-detail-sheet__titles">
              <h2
                id="url-monitoring-latency-detail-title"
                className="url-monitoring-latency-detail-sheet__title"
              >
                {title}
              </h2>
              <div
                className="url-monitoring-latency-detail-sheet__subtitle"
                title={subtitle}
              >
                {subtitle}
              </div>
            </div>
          </div>
        </div>

        <FancyScrollbar
          autoHide={false}
          style={{flex: 1, minHeight: 0}}
          className="url-monitoring-latency-detail-sheet__scroll"
        >
          <div className="url-monitoring-latency-detail-sheet__body">
            <div className="url-monitoring-latency-detail-sheet__chart">
              {latencyChartQueries.length > 0 ? (
                <div className="url-monitoring-latency-detail-sheet__refreshing-graph">
                  <RefreshingGraph
                    source={source}
                    queryType={QueryType.InfluxQL}
                    queries={latencyChartQueries}
                    templates={graphTemplates}
                    timeRange={selectedTimeRange}
                    type={CellType.Line}
                    axes={URL_LATENCY_DETAIL_AXES}
                    graphOptions={URL_LATENCY_DETAIL_CHART_OPTIONS.graphOptions}
                    staticLegend={URL_LATENCY_DETAIL_CHART_OPTIONS.staticLegend}
                    axisLabelWidth={
                      URL_LATENCY_DETAIL_CHART_OPTIONS.axisLabelWidth
                    }
                    containerStyle={
                      URL_LATENCY_DETAIL_CHART_OPTIONS.containerStyle
                    }
                    colors={URL_LATENCY_DETAIL_CHART_COLORS}
                    tableOptions={DEFAULT_TABLE_OPTIONS}
                    fieldOptions={DEFAULT_FIELD_OPTIONS}
                    decimalPlaces={
                      URL_LATENCY_DETAIL_CHART_OPTIONS.decimalPlaces
                    }
                    tableGaugeChartOptions={DEFAULT_TABLE_GAUGE_CHART_OPTIONS}
                    cellID={chartCellId}
                    cellHeight={280}
                    resizerTopHeight={0}
                    cellNote=""
                    cellNoteVisibility={NoteVisibility.Default}
                    inView={isOpen && isVisible}
                    manualRefresh={chartManualRefresh}
                    onZoom={() => {}}
                    editQueryStatus={() => {}}
                    onSetResolution={() => {}}
                  />
                </div>
              ) : (
                <p className="url-monitoring-latency-detail-sheet__chart-empty">
                  Cannot show the chart: Telegraf tags host, method, and server
                  are missing.
                </p>
              )}
            </div>

            <div className="url-monitoring-latency-detail-sheet__section-label url-monitoring-latency-detail-sheet__section-label--table">
              Check history
            </div>
            {loading ? (
              <div className="url-monitoring-latency-detail-sheet__loading">
                <LoadingDots className="openstack-dots--loading" />
              </div>
            ) : detailRows.length === 0 ? (
              <p className="url-monitoring-latency-detail-sheet__empty">
                No raw samples for this time range and target. Check Telegraf
                tags (host, method, server) and collection interval.
              </p>
            ) : (
              <FancyScrollbar
                autoHide={false}
                style={{height: '52vh', width: '100%'}}
                className="url-monitoring-latency-detail-sheet__table-scroll"
              >
                <table className="table table-sm table-striped url-monitoring-latency-detail-sheet__table">
                  <thead>
                    <tr>
                      <th>Check time</th>
                      <th className="text-right">Elapsed</th>
                      <th className="text-right">Body</th>
                      <th className="text-center">Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r, i) => (
                      <tr key={`${String(r.time)}-${i}`}>
                        <td>{formatSampleTime(r.time, timeZone)}</td>
                        <td className="text-right">
                          {r.elapsedMs !== null
                            ? `${Math.round(r.elapsedMs)}ms`
                            : '--'}
                        </td>
                        <td className="text-right">
                          {formatBodyLength(r.bodyBytes)}
                        </td>
                        <td className="text-center">
                          <span
                            className="url-monitoring-latency-detail-sheet__code"
                            style={{
                              backgroundColor: statusBadgeColor(r.statusCode),
                            }}
                          >
                            {r.statusCode ?? '--'}
                          </span>
                        </td>
                        <td>{formatDetailReason(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </FancyScrollbar>
            )}
          </div>
        </FancyScrollbar>
      </div>
    </>
  )
}
