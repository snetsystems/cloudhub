import React, {useEffect, useMemo, useState} from 'react'
import {connect, useSelector} from 'react-redux'
import {useTranslation} from 'react-i18next'
import {bindActionCreators} from 'redux'

import {executeQueries} from 'src/shared/apis/query'
import {getAllDevicesOrg} from 'src/device_management/apis'
import TableComponent from 'src/device_management/components/TableComponent'
import FixedCellFrame from 'src/device_management/components/FixedCellFrame'
import TemplateUpdateBadge from 'src/device_management/components/TemplateUpdateBadge'
import SwitchPortThresholdOverlay from 'src/device_management/components/SwitchPortThresholdOverlay'
import LoadingDots from 'src/shared/components/LoadingDots'
import {
  switchPortColumns,
  switchPortDeviceColumns,
} from 'src/device_management/constants/switchPortColumns'
import {
  DEFAULT_SWITCH_PORT_THRESHOLD,
  longDownDaysToTicks,
} from 'src/device_management/constants/portLinkStatus'
import {readAlias} from 'src/device_management/utils/ifName'
import {num, seriesOf} from 'src/device_management/utils/influxSeries'
import {
  SwitchDeviceMeta,
  SwitchPortSeries,
  buildSwitchPortRows,
} from 'src/device_management/utils/switchPortRows'
import {useAutoRefreshTick} from 'src/device_management/utils/useAutoRefreshTick'
import {useFixedCellTemplateUpdate} from 'src/device_management/utils/useFixedCellTemplateUpdate'
import {useNetworkDevices} from 'src/device_management/utils/useNetworkDevices'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import Authorized, {ADMIN_ROLE} from 'src/auth/Authorized'
import {Button, ButtonShape, ComponentColor, IconFont} from 'src/reusable_ui'
import {DevicesOrgData, Me, SwitchPortThreshold, TimeZones} from 'src/types'
import * as DashboardsModels from 'src/types/dashboards'
import {Notification} from 'src/types/notifications'

interface Props {
  cell: DashboardsModels.Cell
  context: RenderCellContext
  notify?: (message: Notification) => void
}

/** The builtin dashboard this cell is shipped in; drives the update badge. */
const TEMPLATE_NAME = 'snmp'

/**
 * Last link state of every interface. last() is taken per field, and the
 * collector writes them in one point per poll, so they describe one moment.
 */
const PORTS_QUERY =
  'SELECT last("ifAdminStatus") AS "admin", last("ifOperStatus") AS "oper", ' +
  'last("ifType") AS "type", last("ifLastChange") AS "lastChange" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id", "ifName", "ifAlias"'

/** sys_uptime is stored as a string of ticks, so it is parsed here. */
const DEVICE_QUERY =
  'SELECT last("sys_model") AS "model", last("sys_uptime") AS "uptime" ' +
  'FROM "snmp_nx" WHERE time > :dashboardTime: AND time < :upperDashboardTime: ' +
  'GROUP BY "dev_id", "sys_name", "agent_host"'

const INIT_SORT = {key: 'down', isDesc: true}

const SwitchPortsCellContent: React.FC<Props> = ({cell, context, notify}) => {
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
  const devices = useNetworkDevices()
  const templateUpdate = useFixedCellTemplateUpdate(TEMPLATE_NAME, notify)

  const [series, setSeries] = useState<SwitchPortSeries[]>([])
  const [meta, setMeta] = useState<Record<string, SwitchDeviceMeta>>({})
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [threshold, setThreshold] = useState<SwitchPortThreshold>(
    DEFAULT_SWITCH_PORT_THRESHOLD
  )
  const [isThresholdOpen, setIsThresholdOpen] = useState(false)

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
        // Absent until an operator saves it; the shipped default stands in.
        if (org?.switch_port_threshold) {
          setThreshold(org.switch_port_threshold)
        }
      })
      .catch(() => {
        // Keep the default rather than blanking the judgement.
      })

    return () => {
      isCancelled = true
    }
  }, [organizationID])

  // Key the fetch on contents: templates and the time range are rebuilt on
  // every parent render, and depending on their identity refetches in a loop.
  const queryKey = JSON.stringify([templates ?? [], timeRange ?? null])

  useEffect(() => {
    if (!source) {
      return
    }
    let isCancelled = false
    const db = source.telegraf ?? 'Default'

    setIsFetching(true)
    executeQueries(
      source,
      [
        {id: 'snmp-ports', text: PORTS_QUERY, db},
        {id: 'snmp-ports-device', text: DEVICE_QUERY, db},
      ],
      templates ?? []
    )
      .then((res: any) => {
        if (isCancelled) {
          return
        }
        const parsed: SwitchPortSeries[] = seriesOf(res, 0)
          .map(s => {
            const col = (name: string) => s.columns.indexOf(name)
            const last = s.values?.[s.values.length - 1]
            if (!s.tags?.dev_id || !s.tags?.ifName || !last) {
              return null
            }
            return {
              devID: s.tags.dev_id,
              ifName: s.tags.ifName,
              alias: readAlias(s.tags.ifAlias),
              admin: last[col('admin')] ?? '',
              oper: last[col('oper')] ?? '',
              ifType: col('type') < 0 ? null : num(last[col('type')]),
              ifLastChange:
                col('lastChange') < 0 ? null : num(last[col('lastChange')]),
              checkedAt: num(last[col('time')]),
            }
          })
          .filter((p): p is SwitchPortSeries => p !== null)

        const metaByDev: Record<string, SwitchDeviceMeta> = {}
        seriesOf(res, 1).forEach(s => {
          const devID = s.tags?.dev_id
          const row = s.values?.[s.values.length - 1]
          if (!devID || !row) {
            return
          }
          metaByDev[devID] = {
            devID,
            sysName: s.tags?.sys_name ?? '',
            agentHost: s.tags?.agent_host ?? '',
            model: row[s.columns.indexOf('model')] ?? '',
            uptimeTicks: num(row[s.columns.indexOf('uptime')]),
          }
        })

        setSeries(parsed)
        setMeta(metaByDev)
        setError(null)
      })
      .catch((err: any) => {
        if (!isCancelled) {
          setError(err?.message ?? 'Failed to load switch port data')
          setSeries([])
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

  const longDownTicks = longDownDaysToTicks(threshold.long_down_days)

  const {rows, devicesWithoutIfType} = useMemo(
    () => buildSwitchPortRows(series, meta, devices, longDownTicks),
    [series, meta, devices, longDownTicks]
  )

  const noDataMessage =
    error ??
    (devicesWithoutIfType > 0 && rows.length === 0
      ? t(
          'switch_ports.if_type_missing',
          'Switches are reporting, but without ifType. Apply the updated collector settings to see their ports.'
        )
      : t('switch_ports.no_data', 'No switch port data collected.'))

  return (
    <FixedCellFrame
      cell={cell}
      context={context}
      className="optics-cell"
      after={
        <SwitchPortThresholdOverlay
          isOpen={isThresholdOpen}
          onClose={() => setIsThresholdOpen(false)}
          organizationID={organizationID}
          threshold={threshold}
          onSaved={setThreshold}
        />
      }
    >
      <TableComponent
        data={rows}
        columns={switchPortDeviceColumns}
        isAccordion={true}
        accordionColumns={switchPortColumns}
        initSort={INIT_SORT}
        isLoading={isFetching && rows.length === 0}
        timeZone={timeZone}
        searchPlaceholder={t(
          'switch_ports.filter_placeholder',
          'Filter by Device...'
        )}
        options={{noDataMessage}}
        topLeftRender={
          <TemplateUpdateBadge
            update={templateUpdate.update}
            isApplying={templateUpdate.isApplying}
            onApply={templateUpdate.apply}
          />
        }
        toprightRender={
          <>
            {isFetching && <LoadingDots className="optics-loading-dots" />}
            <Authorized requiredRole={ADMIN_ROLE}>
              <Button
                color={ComponentColor.Default}
                shape={ButtonShape.Square}
                icon={IconFont.CogThick}
                titleText={t(
                  'switch_ports.threshold.open',
                  'Switch Port Threshold'
                )}
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

export default connect(null, mdtp)(SwitchPortsCellContent)
