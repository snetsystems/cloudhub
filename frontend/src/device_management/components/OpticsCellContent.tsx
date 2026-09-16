import React, {useEffect, useMemo, useState} from 'react'
import {connect, useSelector} from 'react-redux'
import {useTranslation} from 'react-i18next'
import {bindActionCreators} from 'redux'

import {executeQueries} from 'src/shared/apis/query'
import {resolveTimeRangeBounds} from 'src/shared/utils/timeRangeBounds'
import {getAllDevicesOrg} from 'src/device_management/apis'
import TableComponent from 'src/device_management/components/TableComponent'
import OpticsThresholdOverlay from 'src/device_management/components/OpticsThresholdOverlay'
import LoadingDots from 'src/shared/components/LoadingDots'
import {
  opticsDeviceColumns,
  opticsPortColumns,
  lastPointValue,
} from 'src/device_management/constants/opticsColumns'
import {
  DEFAULT_OPTICS_THRESHOLD,
  judgeOpticsPort,
  OpticsPortStatus,
  opticsSeverity,
  worstOpticsSeverity,
} from 'src/device_management/constants/opticsThreshold'
import {
  DEFAULT_SWITCH_PORT_THRESHOLD,
  interfaceInitTicks,
  longDownDaysToTicks,
} from 'src/device_management/constants/portLinkStatus'
import {
  canonicalIfName,
  comparePorts,
  readAlias,
} from 'src/device_management/utils/ifName'
import {num, seriesOf, toISO} from 'src/device_management/utils/influxSeries'
import {useAutoRefreshTick} from 'src/device_management/utils/useAutoRefreshTick'
import {useNetworkDevices} from 'src/device_management/utils/useNetworkDevices'
import {useFixedCellTemplateUpdate} from 'src/device_management/utils/useFixedCellTemplateUpdate'
import FixedCellFrame from 'src/device_management/components/FixedCellFrame'
import TemplateUpdateBadge from 'src/device_management/components/TemplateUpdateBadge'
import Authorized, {ADMIN_ROLE} from 'src/auth/Authorized'
import {
  Button,
  ButtonShape,
  ComponentColor,
  IconFont,
  Radio,
} from 'src/reusable_ui'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import {
  DevicesOrgData,
  Me,
  OpticsDeviceRow,
  OpticsPoint,
  OpticsPortRow,
  OpticsThreshold,
  SwitchPortThreshold,
  TimeZones,
} from 'src/types'
import * as DashboardsModels from 'src/types/dashboards'
import {Notification} from 'src/types/notifications'
import {notify as notifyAction} from 'src/shared/actions/notifications'

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
  'GROUP BY "dev_id", "sys_name", "agent_host", "ifName", "opticLane"'

/**
 * ifAdminStatus/ifOperStatus live on the interface rows of the same
 * measurement, one per port rather than per lane, so they come back as their
 * own series and get joined onto the optics rows by device + interface.
 */
const LINK_QUERY =
  'SELECT last("ifAdminStatus") AS "admin", last("ifOperStatus") AS "oper", ' +
  'last("ifType") AS "type", last("ifLastChange") AS "lastChange" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id", "ifName", "ifAlias"'

/**
 * How far back a port is remembered.
 *
 * A pulled transceiver stops producing sensor rows, so the port leaves the
 * dashboard's window and the device quietly reads 1/1 where it read 1/2 —
 * the removal never appears. This window is the only record that the port was
 * ever there.
 *
 * 30 days is long enough that a removal is still visible days later, and it
 * costs nothing: the query is an aggregate, so it returns one row per port
 * whatever the window (measured at ~400 ms against 22 devices, against ~260 ms
 * for 7 days). It is deliberately not the dashboard's own time range, which an
 * operator narrows to minutes to read current values.
 *
 * A vanished port is reported as information, not a fault - see `no_module` in
 * opticsThreshold - so a long window costs the operator nothing either. The
 * price of raising it further is only query time.
 */
const BASELINE_QUERY =
  'SELECT last("opticalRxPower") AS "seen" ' +
  'FROM "snmp_nx" WHERE time > now() - 30d ' +
  'GROUP BY "dev_id", "ifName", "opticLane"'

/**
 * The transceiver cages the chassis reports, fitted or not.
 *
 * An empty cage has no sensor and so appears in no optics row: without this a
 * device with two modules in four slots reads "2/2" and nothing says the other
 * two exist. Only Catalyst (IOS-XE) reports cages this way - NX-OS exposes
 * only linecard, power and fan bays - so a device with no rows here has an
 * unknown slot count, not zero.
 */
const SLOT_QUERY =
  'SELECT last("slotFitted") AS "fitted" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id", "ifName"'

/** sys_uptime is stored as a string of ticks, so it is parsed here. */
const MODEL_QUERY =
  'SELECT last("sys_model") AS "model", last("sys_uptime") AS "uptime" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id"'

/** Interface-level link state, keyed by `<dev_id>|<ifName>`. */
interface LinkState {
  admin: string
  oper: string
  alias: string
  /** IANAifType, null before the collector sends it. */
  type: number | null
  /** TimeTicks of the last oper change, null before the collector sends it. */
  lastChange: number | null
}

/** A transceiver cage the chassis reports, and whether anything is in it. */
interface SlotState {
  ifName: string
  fitted: boolean
}

/** A port that reported optics inside the baseline window, and when it last did. */
interface BaselinePort {
  ifName: string
  lane: string
  seenAt: number | null
}

/** Per-port series pulled out of one InfluxDB series. */
interface PortSeries {
  devID: string
  sysName: string
  /** The address the collector polled, which is the device's own IP. */
  agentHost: string
  ifName: string
  lane: string
  tx: OpticsPoint[]
  rx: OpticsPoint[]
  temp: OpticsPoint[]
  status: string
  checkedAt: number | null
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
  const {source, templates, manualRefresh, timeRange} = context
  const {t} = useTranslation()
  const timeZone = useSelector(
    (state: {app?: {persisted?: {timeZone?: TimeZones}}}) =>
      state.app?.persisted?.timeZone ?? TimeZones.Local
  )
  const organizationID = useSelector(
    (state: {auth?: {me?: Me}}) => state.auth?.me?.currentOrganization?.id ?? ''
  )
  const autoRefreshTick = useAutoRefreshTick()
  const [ports, setPorts] = useState<PortSeries[]>([])
  const [models, setModels] = useState<Record<string, string>>({})
  const [uptimes, setUptimes] = useState<Record<string, number | null>>({})
  const [links, setLinks] = useState<Record<string, LinkState>>({})
  const [baseline, setBaseline] = useState<Record<string, BaselinePort[]>>({})
  const [slots, setSlots] = useState<Record<string, SlotState[]>>({})
  const devices = useNetworkDevices()
  const [isTrend, setIsTrend] = useState(false)
  const [threshold, setThreshold] = useState<OpticsThreshold>(
    DEFAULT_OPTICS_THRESHOLD
  )
  // Shared with the switch ports cell so the two never judge one port
  // differently. Configured (and saved) from the switch ports cell's own
  // gear button; this cell only reads it, off the same org record.
  const [
    switchPortThreshold,
    setSwitchPortThreshold,
  ] = useState<SwitchPortThreshold>(DEFAULT_SWITCH_PORT_THRESHOLD)
  const [isThresholdOpen, setIsThresholdOpen] = useState(false)
  const templateUpdate = useFixedCellTemplateUpdate(
    OPTICS_TEMPLATE_NAME,
    notify
  )
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)

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
        // Same org record, same "absent means shipped default" rule. Tested as
        // an object, not the number: a saved 0 (off) must not fall back to 7.
        if (org?.switch_port_threshold) {
          setSwitchPortThreshold(org.switch_port_threshold)
        }
      })
      .catch(() => {
        // Keep the defaults rather than blanking the judgement.
      })

    return () => {
      isCancelled = true
    }
  }, [organizationID])

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
      {id: 'snmp-optics-baseline', text: BASELINE_QUERY, db},
      {id: 'snmp-optics-slots', text: SLOT_QUERY, db},
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
            agentHost: s.tags?.agent_host ?? '',
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
        const uptimeByDev: Record<string, number | null> = {}
        seriesOf(res, 1).forEach(s => {
          const iModel = s.columns.indexOf('model')
          const iUptime = s.columns.indexOf('uptime')
          const value = s.values?.[0]?.[iModel]
          if (s.tags?.dev_id && value) {
            modelByDev[s.tags.dev_id] = value
          }
          if (s.tags?.dev_id) {
            uptimeByDev[s.tags.dev_id] = num(s.values?.[0]?.[iUptime])
          }
        })

        const linkByPort: Record<string, LinkState> = {}
        seriesOf(res, 2).forEach(s => {
          const iAdmin = s.columns.indexOf('admin')
          const iOper = s.columns.indexOf('oper')
          const iType = s.columns.indexOf('type')
          const iLastChange = s.columns.indexOf('lastChange')
          const last = s.values?.[s.values.length - 1]
          if (s.tags?.dev_id && s.tags?.ifName && last) {
            linkByPort[`${s.tags.dev_id}|${canonicalIfName(s.tags.ifName)}`] = {
              admin: last[iAdmin] ?? '',
              oper: last[iOper] ?? '',
              alias: readAlias(s.tags?.ifAlias),
              type: iType < 0 ? null : num(last[iType]),
              lastChange: iLastChange < 0 ? null : num(last[iLastChange]),
            }
          }
        })

        const baselineByDev: Record<string, BaselinePort[]> = {}
        seriesOf(res, 3).forEach(s => {
          const devID = s.tags?.dev_id
          if (!devID || !s.tags?.ifName) {
            return
          }
          const last = s.values?.[s.values.length - 1]
          if (!baselineByDev[devID]) {
            baselineByDev[devID] = []
          }
          baselineByDev[devID].push({
            ifName: s.tags.ifName,
            lane: s.tags?.opticLane ?? '',
            seenAt: num(last?.[s.columns.indexOf('time')]),
          })
        })

        const slotsByDev: Record<string, SlotState[]> = {}
        seriesOf(res, 4).forEach(s => {
          const devID = s.tags?.dev_id
          if (!devID || !s.tags?.ifName) {
            return
          }
          const last = s.values?.[s.values.length - 1]
          if (!slotsByDev[devID]) {
            slotsByDev[devID] = []
          }
          slotsByDev[devID].push({
            ifName: s.tags.ifName,
            fitted: num(last?.[s.columns.indexOf('fitted')]) === 1,
          })
        })

        setPorts(parsed)
        setModels(modelByDev)
        setUptimes(uptimeByDev)
        setLinks(linkByPort)
        setBaseline(baselineByDev)
        setSlots(slotsByDev)
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

  const longDownTicks = longDownDaysToTicks(switchPortThreshold.long_down_days)

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
        // Every interface of the device, not only the optics ones, decides
        // when its interfaces came up.
        const initTicks = interfaceInitTicks(
          Object.entries(links)
            .filter(([key]) => key.startsWith(`${devID}|`))
            .map(([, l]) => ({ifType: l.type, ifLastChange: l.lastChange}))
        )
        // Every port of a device lands in one write, so a fitted port carries
        // the device's newest timestamp. One that has fallen a poll behind has
        // stopped reporting — its transceiver is gone.
        const deviceLatest = Math.max(...sorted.map(p => p.checkedAt ?? 0))
        const staleAfter = pollGapOf(sorted) * 1.5
        const isReporting = (p: PortSeries) =>
          staleAfter <= 0 ||
          p.checkedAt === null ||
          deviceLatest - p.checkedAt <= staleAfter
        // A reading counts as live only while the port is still reporting AND
        // the device calls its sensor usable. A cage the device reports as
        // unavailable keeps returning the last number the departed module gave,
        // and showing that next to "NO MODULE" reads as a live measurement.
        const hasLiveReading = (p: PortSeries) =>
          isReporting(p) && p.status !== 'no_module'
        const livePorts = sorted.filter(hasLiveReading)
        const worstTx = worstPort(livePorts, 'tx', 'min')
        const worstRx = worstPort(livePorts, 'rx', 'min')
        const worstTemp = worstPort(livePorts, 'temp', 'max')
        const portRows: OpticsPortRow[] = sorted.map(p => {
          const reporting = isReporting(p)
          const isLive = hasLiveReading(p)
          const tx = isLive ? lastPointValue(p.tx) : null
          const rx = isLive ? lastPointValue(p.rx) : null
          const temp = isLive ? lastPointValue(p.temp) : null
          const link = links[`${devID}|${canonicalIfName(p.ifName)}`]
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
                ifLastChange: link?.lastChange,
                isReporting: reporting,
                tx,
                rx,
                temp,
              },
              threshold,
              initTicks,
              uptimes[devID] ?? null,
              longDownTicks
            ),
            checkedAt: toISO(p.checkedAt),
          }
        })
        // Ports the baseline remembers but the current window has none of: the
        // transceiver is gone. They are only added to a device that is still
        // reporting something - a device that went silent altogether is a
        // collection outage, and turning that into one removal per port would
        // report a rack of pulled modules every time a switch or the collector
        // hiccups.
        const present = new Set(sorted.map(p => `${p.ifName}|${p.lane}`))
        const vanished: OpticsPortRow[] = (baseline[devID] ?? [])
          .filter(b => !present.has(`${b.ifName}|${b.lane}`))
          .map(b => ({
            id: `${devID}|${b.ifName}|${b.lane}`,
            devID,
            ifName: b.ifName,
            alias: links[`${devID}|${canonicalIfName(b.ifName)}`]?.alias ?? '',
            lane: b.lane,
            tx: null,
            rx: null,
            temp: null,
            status: 'no_module' as OpticsPortStatus,
            // When it was last seen, which is what says when it went.
            checkedAt: toISO(b.seenAt),
          }))
        // Cages the chassis reports with nothing in them. A cage the baseline
        // already accounted for is the same port seen from the other side, so
        // it is matched by name to keep it from appearing twice.
        const named = new Set(
          [...portRows, ...vanished].map(p => canonicalIfName(p.ifName))
        )
        const emptyCages: OpticsPortRow[] = (slots[devID] ?? [])
          .filter(c => !c.fitted && !named.has(canonicalIfName(c.ifName)))
          .map(c => ({
            id: `${devID}|${c.ifName}|`,
            devID,
            ifName: c.ifName,
            alias: links[`${devID}|${canonicalIfName(c.ifName)}`]?.alias ?? '',
            lane: '',
            tx: null,
            rx: null,
            temp: null,
            status: 'no_module' as OpticsPortStatus,
            checkedAt: '',
          }))
        const allPorts = [...portRows, ...vanished, ...emptyCages].sort(
          comparePorts
        )
        // Only Catalyst reports cages, so an empty list means the count is
        // unknown. "2/0" would be a claim about hardware that was never made.
        const cages = slots[devID] ?? []
        const slotRatio = cages.length
          ? `${cages.filter(c => c.fitted).length}/${cages.length}`
          : ''

        // Shut and unpopulated ports are neither healthy nor faulty, so they
        // are left out of the ratio instead of dragging it down.
        const watched = allPorts.filter(
          p => opticsSeverity(p.status as OpticsPortStatus) !== 'none'
        )
        const okCount = watched.filter(p => p.status === 'ok').length

        return {
          id: devID,
          sysName: sorted[0]?.sysName || device?.hostname || devID,
          model: models[devID] ?? '',
          // The device list is scoped to the session's organization, but a source
          // can point at another organization's database, so the lookup finds
          // nothing. The polled address is the same IP and always travels with
          // the data.
          ip: device?.device_ip || sorted[0]?.agentHost || '',
          location: device?.location ?? '',
          tx: worstTx?.tx ?? [],
          txPort: worstTx?.ifName ?? '',
          rx: worstRx?.rx ?? [],
          rxPort: worstRx?.ifName ?? '',
          temp: worstTemp?.temp ?? [],
          tempPort: worstTemp?.ifName ?? '',
          status: `${okCount}/${watched.length}`,
          slots: slotRatio,
          severity: worstOpticsSeverity(
            watched.map(p => p.status as OpticsPortStatus)
          ),
          checkedAt: toISO(
            Math.max(...sorted.map(p => p.checkedAt ?? 0)) || null
          ),
          ports: allPorts,
        }
      })
      .sort((a, b) => a.sysName.localeCompare(b.sysName))
  }, [
    ports,
    devices,
    models,
    uptimes,
    links,
    baseline,
    slots,
    threshold,
    longDownTicks,
  ])

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
    <FixedCellFrame
      cell={cell}
      context={context}
      className="optics-cell"
      after={
        <OpticsThresholdOverlay
          isOpen={isThresholdOpen}
          onClose={() => setIsThresholdOpen(false)}
          organizationID={organizationID}
          threshold={threshold}
          source={source}
          onSaved={setThreshold}
        />
      }
    >
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
            <TemplateUpdateBadge
              update={templateUpdate.update}
              isApplying={templateUpdate.isApplying}
              onApply={templateUpdate.apply}
            />
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
    </FixedCellFrame>
  )
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(null, mdtp)(OpticsCellContent)
