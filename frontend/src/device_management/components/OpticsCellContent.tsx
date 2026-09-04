import React, {useEffect, useMemo, useState} from 'react'
import {connect, useSelector} from 'react-redux'
import {useTranslation} from 'react-i18next'
import {bindActionCreators} from 'redux'

import {executeQueries} from 'src/shared/apis/query'
import {applyFixedCell, getDashboards} from 'src/dashboards/apis'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {resolveTimeRangeBounds} from 'src/shared/utils/timeRangeBounds'
import {getAllDevicesOrg, getDeviceList} from 'src/device_management/apis'
import TableComponent from 'src/device_management/components/TableComponent'
import OpticsThresholdOverlay from 'src/device_management/components/OpticsThresholdOverlay'
import LayoutCellMenu from 'src/shared/components/LayoutCellMenu'
import LoadingDots from 'src/shared/components/LoadingDots'
import LayoutCellHeader from 'src/shared/components/LayoutCellHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {
  opticsDeviceColumns,
  opticsPortColumns,
  lastPointValue,
} from 'src/device_management/constants/opticsColumns'
import {
  DEFAULT_OPTICS_THRESHOLD,
  judgeOpticsPort,
} from 'src/device_management/constants/opticsThreshold'
import Authorized, {ADMIN_ROLE, EDITOR_ROLE} from 'src/auth/Authorized'
import {
  Button,
  ButtonShape,
  ComponentColor,
  IconFont,
  Radio,
} from 'src/reusable_ui'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import {
  DeviceData,
  DevicesOrgData,
  Me,
  OpticsDeviceRow,
  OpticsPoint,
  OpticsPortRow,
  OpticsThreshold,
  TimeZones,
} from 'src/types'
import * as DashboardsModels from 'src/types/dashboards'
import {VisType} from 'src/types/flux'
import {Notification} from 'src/types/notifications'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyTemplateUpdated,
  notifyTemplateUpdateFailed,
} from 'src/shared/copy/notifications'

interface Props {
  cell: DashboardsModels.Cell
  context: RenderCellContext
  notify?: (message: Notification) => void
}

/** The builtin dashboard this cell is shipped in; drives the update badge. */
const OPTICS_TEMPLATE_NAME = 'snmp'

/**
 * Raw samples, not `GROUP BY time()`. The collector writes all three readings
 * under one timestamp, so raw rows already line up, and a bucket would report
 * its own start as the reading time — up to a minute earlier than the reading
 * actually is. Trend reads the whole series, Gauge the last row.
 */
const OPTICS_QUERY =
  'SELECT "opticalTxPower" AS "tx", "opticalRxPower" AS "rx", ' +
  '"opticalTemperature" AS "temp", "opticStatus" AS "status" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id", "sys_name", "ifName", "opticLane"'

/**
 * ifAdminStatus/ifOperStatus live on the interface rows of the same
 * measurement, one per port rather than per lane, so they come back as their
 * own series and get joined onto the optics rows by device + interface.
 */
const LINK_QUERY =
  'SELECT last("ifAdminStatus") AS "admin", last("ifOperStatus") AS "oper" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id", "ifName", "ifAlias"'

const MODEL_QUERY =
  'SELECT last("sys_model") AS "model" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id"'

/** Interface-level link state, keyed by `<dev_id>|<ifName>`. */
interface LinkState {
  admin: string
  oper: string
  alias: string
}

/** The collector writes "unknown" when the device reports no description. */
const readAlias = (value: string | undefined): string =>
  !value || value === 'unknown' ? '' : value

/** Per-port series pulled out of one InfluxDB series. */
interface PortSeries {
  devID: string
  sysName: string
  ifName: string
  lane: string
  tx: OpticsPoint[]
  rx: OpticsPoint[]
  temp: OpticsPoint[]
  status: string
  checkedAt: number | null
}

const seriesOf = (res: any, index: number): any[] =>
  res?.[index]?.value?.results?.[0]?.series ?? []

const num = (v: any): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

/**
 * Sorts ports the way an operator reads them: Ethernet1/2 before Ethernet1/10,
 * which a plain string compare gets wrong.
 */
const comparePorts = (a: {ifName: string}, b: {ifName: string}): number => {
  const segsOf = (s: string) => (s.match(/\d+/g) ?? []).map(Number)
  const [sa, sb] = [segsOf(a.ifName), segsOf(b.ifName)]
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const diff = (sa[i] ?? -1) - (sb[i] ?? -1)
    if (diff !== 0) {
      return diff
    }
  }
  return a.ifName.localeCompare(b.ifName)
}

/**
 * Picks the port an operator should look at first: the weakest signal, or the
 * hottest transceiver. Ports with no reading at all are skipped.
 */
const worstPort = (
  ports: PortSeries[],
  metric: 'tx' | 'rx' | 'temp',
  pick: 'min' | 'max'
): PortSeries | null =>
  ports.reduce<PortSeries | null>((worst, port) => {
    const value = lastPointValue(port[metric])
    if (value === null) {
      return worst
    }
    const worstValue = worst === null ? null : lastPointValue(worst[metric])
    if (worstValue === null) {
      return port
    }
    const isWorse = pick === 'min' ? value < worstValue : value > worstValue
    return isWorse ? port : worst
  }, null)

const toISO = (ms: number | null): string =>
  ms ? new Date(ms).toISOString() : ''

/**
 * Gap between a device's two most recent polls, taken from whichever port is
 * furthest along. Ports of one device are written in a single batch, so this
 * is the device's own cadence rather than an assumed interval.
 */
const pollGapOf = (ports: PortSeries[]): number => {
  const times = ports
    .flatMap(port => port.rx.map(point => point.time))
    .filter(time => time > 0)
  const distinct = Array.from(new Set(times)).sort((a, b) => a - b)
  return distinct.length > 1
    ? distinct[distinct.length - 1] - distinct[distinct.length - 2]
    : 0
}

const OpticsCellContent: React.FC<Props> = ({cell, context, notify}) => {
  const {
    source,
    templates,
    manualRefresh,
    timeRange,
    isEditable,
    onDeleteCell,
    onCloneCell,
    onRenameCell,
  } = context
  const {t} = useTranslation()
  const timeZone = useSelector(
    (state: {app?: {persisted?: {timeZone?: TimeZones}}}) =>
      state.app?.persisted?.timeZone ?? TimeZones.Local
  )
  const organizationID = useSelector(
    (state: {auth?: {me?: Me}}) => state.auth?.me?.currentOrganization?.id ?? ''
  )
  // RenderCellContext carries manualRefresh but not the auto refresh interval,
  // and the dashboard keeps that rate per dashboard rather than in app state.
  // GlobalAutoRefresher is what the page already polls on, so subscribing to it
  // ticks in step with every other cell.
  const [autoRefreshTick, setAutoRefreshTick] = useState(0)

  useEffect(() => {
    const tick = () => setAutoRefreshTick(count => count + 1)
    GlobalAutoRefresher.subscribe(tick)
    return () => GlobalAutoRefresher.unsubscribe(tick)
  }, [])
  const [ports, setPorts] = useState<PortSeries[]>([])
  const [models, setModels] = useState<Record<string, string>>({})
  const [links, setLinks] = useState<Record<string, LinkState>>({})
  const [devices, setDevices] = useState<Record<string, DeviceData>>({})
  const [isTrend, setIsTrend] = useState(false)
  const [threshold, setThreshold] = useState<OpticsThreshold>(
    DEFAULT_OPTICS_THRESHOLD
  )
  const [isThresholdOpen, setIsThresholdOpen] = useState(false)
  const [templateUpdate, setTemplateUpdate] = useState<{
    from: string
    to: string
  } | null>(null)
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    let isCancelled = false

    getDeviceList()
      .then(res => {
        if (isCancelled) {
          return
        }
        const byID: Record<string, DeviceData> = {}
        ;(res?.data?.devices ?? []).forEach((d: DeviceData) => {
          if (d.id) {
            byID[d.id] = d
          }
        })
        setDevices(byID)
      })
      .catch(() => {
        // Device metadata is decoration; optics data still renders without it.
      })

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!organizationID) {
      return
    }
    let isCancelled = false

    getAllDevicesOrg()
      .then(({data}) => {
        if (isCancelled) {
          return
        }
        const org = (data?.organizations ?? []).find(
          (o: DevicesOrgData) => o.organization === organizationID
        )
        // Absent until an operator saves it; the shipped defaults stand in.
        if (org?.optics_threshold) {
          setThreshold(org.optics_threshold)
        }
      })
      .catch(() => {
        // Keep the defaults rather than blanking the judgement.
      })

    return () => {
      isCancelled = true
    }
  }, [organizationID])

  const loadTemplateVersion = async () => {
    try {
      const {data} = await getDashboards()
      const template = (data?.dashboards ?? []).find(
        (d: DashboardsModels.Dashboard) => d.name === OPTICS_TEMPLATE_NAME
      )
      setTemplateUpdate(
        template?.updateAvailable
          ? {from: template.version ?? '—', to: template.latestVersion ?? '—'}
          : null
      )
    } catch {
      // No update badge is better than a wrong one.
    }
  }

  useEffect(() => {
    loadTemplateVersion()
  }, [])

  const handleApplyTemplate = async () => {
    setIsApplyingUpdate(true)
    try {
      await applyFixedCell(OPTICS_TEMPLATE_NAME)
      await loadTemplateVersion()
      notify(notifyTemplateUpdated())
    } catch (error) {
      notify(notifyTemplateUpdateFailed(error?.message ?? 'unknown error'))
    } finally {
      setIsApplyingUpdate(false)
    }
  }

  // `templates` (and the time range on some pages) are rebuilt on every parent
  // render, so key the fetch on their contents. Depending on the array identity
  // refetches in a loop: fetch -> setState -> render -> new array -> fetch.
  const queryKey = JSON.stringify([templates ?? [], timeRange ?? null])

  useEffect(() => {
    if (!source) {
      return
    }
    let isCancelled = false
    const db = source.telegraf ?? 'Default'
    const queries = [
      {id: 'snmp-optics', text: OPTICS_QUERY, db},
      {id: 'snmp-optics-model', text: MODEL_QUERY, db},
      {id: 'snmp-optics-link', text: LINK_QUERY, db},
    ]

    setIsFetching(true)
    executeQueries(source, queries, templates ?? [])
      .then((res: any) => {
        if (isCancelled) {
          return
        }
        const parsed: PortSeries[] = seriesOf(res, 0).map(s => {
          const col = (name: string) => s.columns.indexOf(name)
          const [iTime, iTx, iRx, iTemp, iStatus] = [
            col('time'),
            col('tx'),
            col('rx'),
            col('temp'),
            col('status'),
          ]
          const rows: any[] = s.values ?? []
          const pointsOf = (index: number): OpticsPoint[] =>
            rows.map(v => ({time: num(v[iTime]) ?? 0, value: num(v[index])}))
          const lastRow = rows[rows.length - 1]

          return {
            devID: s.tags?.dev_id ?? '',
            sysName: s.tags?.sys_name ?? '',
            ifName: s.tags?.ifName ?? '',
            lane: s.tags?.opticLane ?? '',
            tx: pointsOf(iTx),
            rx: pointsOf(iRx),
            temp: pointsOf(iTemp),
            status: lastRow?.[iStatus] ?? '',
            checkedAt: num(lastRow?.[iTime]),
          }
        })

        const modelByDev: Record<string, string> = {}
        seriesOf(res, 1).forEach(s => {
          const i = s.columns.indexOf('model')
          const value = s.values?.[0]?.[i]
          if (s.tags?.dev_id && value) {
            modelByDev[s.tags.dev_id] = value
          }
        })

        const linkByPort: Record<string, LinkState> = {}
        seriesOf(res, 2).forEach(s => {
          const iAdmin = s.columns.indexOf('admin')
          const iOper = s.columns.indexOf('oper')
          const last = s.values?.[s.values.length - 1]
          if (s.tags?.dev_id && s.tags?.ifName && last) {
            linkByPort[`${s.tags.dev_id}|${s.tags.ifName}`] = {
              admin: last[iAdmin] ?? '',
              oper: last[iOper] ?? '',
              alias: readAlias(s.tags?.ifAlias),
            }
          }
        })

        setPorts(parsed)
        setModels(modelByDev)
        setLinks(linkByPort)
        setError(null)
      })
      .catch((err: any) => {
        if (!isCancelled) {
          setError(err?.message ?? 'Failed to load optical data')
          setPorts([])
        }
      })
      .then(() => {
        if (!isCancelled) {
          setIsFetching(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [source, queryKey, manualRefresh, autoRefreshTick])

  // One row per device, carrying the worst port per metric plus every port for
  // the expanded view. Device metadata arrives separately, so fold it in here.
  const tableData: OpticsDeviceRow[] = useMemo(() => {
    const byDevice = new Map<string, PortSeries[]>()
    ports.forEach(port => {
      if (!byDevice.has(port.devID)) {
        byDevice.set(port.devID, [])
      }
      byDevice.get(port.devID).push(port)
    })

    return Array.from(byDevice.entries())
      .map(([devID, devicePorts]) => {
        const sorted = [...devicePorts].sort(comparePorts)
        const device = devices[devID]
        // Every port of a device lands in one write, so a fitted port carries
        // the device's newest timestamp. One that has fallen a poll behind has
        // stopped reporting — its transceiver is gone.
        const deviceLatest = Math.max(...sorted.map(p => p.checkedAt ?? 0))
        const staleAfter = pollGapOf(sorted) * 1.5
        const isReporting = (p: PortSeries) =>
          staleAfter <= 0 ||
          p.checkedAt === null ||
          deviceLatest - p.checkedAt <= staleAfter
        const reportingPorts = sorted.filter(isReporting)
        const worstTx = worstPort(reportingPorts, 'tx', 'min')
        const worstRx = worstPort(reportingPorts, 'rx', 'min')
        const worstTemp = worstPort(reportingPorts, 'temp', 'max')
        const portRows: OpticsPortRow[] = sorted.map(p => {
          const reporting = isReporting(p)
          // A stale reading is not a current one; showing the last number a
          // pulled module gave would read as live.
          const tx = reporting ? lastPointValue(p.tx) : null
          const rx = reporting ? lastPointValue(p.rx) : null
          const temp = reporting ? lastPointValue(p.temp) : null
          const link = links[`${devID}|${p.ifName}`]
          return {
            id: `${devID}|${p.ifName}|${p.lane}`,
            devID,
            ifName: p.ifName,
            alias: link?.alias ?? '',
            lane: p.lane,
            tx,
            rx,
            temp,
            status: judgeOpticsPort(
              {
                sensorStatus: p.status,
                adminStatus: link?.admin,
                operStatus: link?.oper,
                isReporting: reporting,
                tx,
                rx,
                temp,
              },
              threshold
            ),
            checkedAt: toISO(p.checkedAt),
          }
        })
        // Shut and unpopulated ports are neither healthy nor faulty, so they
        // are left out of the ratio instead of dragging it down.
        const watched = portRows.filter(
          p => p.status !== 'shutdown' && p.status !== 'no_module'
        )
        const okCount = watched.filter(p => p.status === 'ok').length

        return {
          id: devID,
          sysName: sorted[0]?.sysName || device?.hostname || devID,
          model: models[devID] ?? '',
          ip: device?.device_ip ?? '',
          location: device?.location ?? '',
          tx: worstTx?.tx ?? [],
          txPort: worstTx?.ifName ?? '',
          rx: worstRx?.rx ?? [],
          rxPort: worstRx?.ifName ?? '',
          temp: worstTemp?.temp ?? [],
          tempPort: worstTemp?.ifName ?? '',
          status: `${okCount}/${watched.length}`,
          isHealthy: okCount === watched.length,
          checkedAt: toISO(
            Math.max(...sorted.map(p => p.checkedAt ?? 0)) || null
          ),
          ports: portRows,
        }
      })
      .sort((a, b) => a.sysName.localeCompare(b.sysName))
  }, [ports, devices, models, links, threshold])

  // Anchor the trend x axis to the dashboard's own window, recomputed on every
  // refresh tick. SNMP polls once a minute, so without this the line only
  // shifts when a new sample lands; with a fixed span ending at now, the window
  // slides on each refresh and the chart reads as live.
  const xDomain = useMemo<[number, number] | undefined>(() => {
    if (!isTrend) {
      return undefined
    }
    return resolveTimeRangeBounds(timeRange) ?? undefined
  }, [isTrend, timeRange, autoRefreshTick])

  const columns = useMemo(
    () => opticsDeviceColumns(isTrend, threshold, xDomain),
    [isTrend, threshold, xDomain]
  )

  return (
    <div className="dash-graph optics-cell">
      {/* renderCell bypasses LayoutCell, so this cell brings its own header and
          context menu; without them it cannot be cloned or deleted. The pencil
          hides itself for a cell with no queries. */}
      <Authorized requiredRole={EDITOR_ROLE}>
        <LayoutCellMenu
          cell={cell}
          isEditable={isEditable}
          dataExists={false}
          showInformationSupported={false}
          onEdit={() => {}}
          onClone={onCloneCell}
          onDelete={onDeleteCell}
          isCloneable={false}
          onCSVDownload={() => {}}
          onShowInformation={() => {}}
          queries={[]}
          isFluxQuery={false}
          visType={VisType.Graph}
          toggleVisType={() => {}}
        />
      </Authorized>
      <LayoutCellHeader
        cellName={cell.name}
        isEditable={isEditable}
        makeSpaceForCellNote={false}
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        onRename={
          onRenameCell ? (name: string) => onRenameCell(cell, name) : undefined
        }
      />
      <div className="dash-graph--container">
        {/* Spinner only while there is nothing to show; a refresh keeps the
            current rows on screen instead of blanking the cell. */}
        <TableComponent
          data={tableData}
          columns={columns}
          isAccordion={true}
          accordionColumns={opticsPortColumns}
          isLoading={isFetching && tableData.length === 0}
          timeZone={timeZone}
          searchPlaceholder={t(
            'optics.filter_placeholder',
            'Filter by Device...'
          )}
          options={{
            noDataMessage:
              error ??
              t('optics.no_data', 'No optical transceiver data collected.'),
          }}
          topLeftRender={
            <>
              {templateUpdate && (
                <div className="optics-template-update">
                  <span className="optics-template-update--version">
                    v{templateUpdate.from} → v{templateUpdate.to}
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    disabled={isApplyingUpdate}
                    onClick={handleApplyTemplate}
                  >
                    {isApplyingUpdate
                      ? t('button.saving', 'Saving...')
                      : t('optics.template_update', 'Update')}
                  </button>
                </div>
              )}
              <Radio shape={ButtonShape.Default}>
                <Radio.Button
                  id="optics-mode-gauge"
                  titleText="Gauge"
                  value="gauge"
                  active={!isTrend}
                  onClick={() => setIsTrend(false)}
                >
                  Gauge
                </Radio.Button>
                <Radio.Button
                  id="optics-mode-trend"
                  titleText="Trend"
                  value="trend"
                  active={isTrend}
                  onClick={() => setIsTrend(true)}
                >
                  Trend
                </Radio.Button>
              </Radio>
            </>
          }
          toprightRender={
            <>
              {/* Refetching indicator, in the panel heading rather than over the
                  chart: the cell container clips anything above its top edge.
                  Same placement the server list uses. */}
              {isFetching && <LoadingDots className="optics-loading-dots" />}
              <Authorized requiredRole={ADMIN_ROLE}>
                <Button
                  color={ComponentColor.Default}
                  shape={ButtonShape.Square}
                  icon={IconFont.CogThick}
                  titleText={t('optics.threshold.open', 'Optics Thresholds')}
                  onClick={() => setIsThresholdOpen(true)}
                />
              </Authorized>
            </>
          }
          fancyScroll={true}
          fancyScrollHeight="100%"
        />
      </div>
      <OpticsThresholdOverlay
        isOpen={isThresholdOpen}
        onClose={() => setIsThresholdOpen(false)}
        organizationID={organizationID}
        threshold={threshold}
        source={source}
        onSaved={setThreshold}
      />
    </div>
  )
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(null, mdtp)(OpticsCellContent)
