import React, {MouseEvent} from 'react'
import classnames from 'classnames'
import {unitIndicator, usageIndacator} from 'src/addon/128t/reusable'
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants'
import {Router, TopSource, TopSession, OncueData} from 'src/addon/128t/types'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'
import {transBps} from 'src/shared/utils/units'
import {TableBodyRowItem} from 'src/addon/128t/reusable/layout'
import GeoLocationIndicator from 'src/addon/128t/components/GeoLocationIndicator'

interface Props {
  isCheck: boolean
  handleRouterCheck: ({router: Router}) => void
  router: Router
  focusedAssetId: string
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
  handleOnClickRouterName: (data: {
    _event: MouseEvent<HTMLElement>
    router: Router
  }) => void
  oncueData: OncueData
}

const RouterTableRow = ({
  handleRouterCheck,
  onClickTableRow,
  focusedAssetId,
  router,
  isCheck,
  handleOnClickRouterName,
  oncueData,
}: Props) => {
  const {
    assetId,
    ipAddress,
    locationCoordinates,
    bandwidth_avg,
    session_arrivals,
    role,
    startTime,
    softwareVersion,
    memoryUsage,
    cpuUsage,
    diskUsage,
    topSources,
    topSessions,
  } = router

  const {
    ASSETID,
    IPADDRESS,
    LOCATIONCOORDINATES,
    MANAGEMENTCONNECTED,
    BANDWIDTH_AVG,
    SESSION_CNT_AVG,
    ENABLED,
    ROLE,
    STARTTIME,
    SOFTWAREVERSION,
    MEMORYUSAGE,
    CPUUSAGE,
    DISKUSAGE,
    CHECKBOX,
  } = ROUTER_TABLE_SIZING

  const focusedClasses = (assetId: Router['assetId']): string => {
    if (assetId === focusedAssetId)
      return 'hosts-table--tr cursor--pointer focused'
    return 'hosts-table--tr cursor--pointer'
  }

  const responseIndicator = (isEnabled: boolean): JSX.Element => {
    return (
      <span
        className={classnames('status-indicator', {
          'status-indicator--enabled': isEnabled,
        })}
      />
    )
  }

  const enabledIndicator = (enabled: Router['enabled']): JSX.Element => {
    return responseIndicator(enabled)
  }

  const connectedIndicator = (
    managementConnected: Router['managementConnected']
  ): JSX.Element => {
    return responseIndicator(managementConnected)
  }

  const geoLocationIndicatorCall = (
    locationCoordinates: Router['locationCoordinates']
  ): JSX.Element => {
    return locationCoordinates ? (
      <GeoLocationIndicator locationCoordinates={locationCoordinates} />
    ) : (
      <div>-</div>
    )
  }

  const getHandleRouterCheck = (event: MouseEvent) => {
    event.stopPropagation()
    handleRouterCheck({router})
  }

  return (
    <div
      className={focusedClasses(router.assetId)}
      onClick={onClickTableRow(topSources, topSessions, assetId)}
    >
      <TableBodyRowItem
        title={
          <input
            type="checkbox"
            checked={isCheck}
            onClick={getHandleRouterCheck.bind(router)}
            readOnly
          />
        }
        width={CHECKBOX}
      />
      <TableBodyRowItem
        title={
          <div
            onClick={(e) => {
              handleOnClickRouterName({_event: e, router})
            }}
            className={`cursor--pointer`}
            style={{width: '100%'}}
          >
            <div
              className={classnames('hosts-table-item', {
                focused: oncueData.router === assetId,
              })}
            >
              {assetId}
            </div>
          </div>
        }
        width={ASSETID}
      />
      <TableBodyRowItem title={ipAddress} width={IPADDRESS} />
      <TableBodyRowItem title={role} width={ROLE} />
      <TableBodyRowItem
        title={enabledIndicator(router.enabled)}
        width={ENABLED}
        className={'align--start'}
      />

      <TableBodyRowItem
        title={geoLocationIndicatorCall(locationCoordinates)}
        width={LOCATIONCOORDINATES}
      />
      <TableBodyRowItem
        title={connectedIndicator(router.managementConnected)}
        width={MANAGEMENTCONNECTED}
        className={'align--start'}
      />

      <TableBodyRowItem title={startTime} width={STARTTIME} />
      <TableBodyRowItem
        title={softwareVersion}
        width={SOFTWAREVERSION}
        className={'align--start'}
      />
      <TableBodyRowItem
        title={usageIndacator({value: fixedDecimalPercentage(cpuUsage, 2)})}
        width={CPUUSAGE}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={usageIndacator({value: fixedDecimalPercentage(memoryUsage, 2)})}
        width={MEMORYUSAGE}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={usageIndacator({value: fixedDecimalPercentage(diskUsage, 2)})}
        width={DISKUSAGE}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={unitIndicator(transBps(bandwidth_avg * 8, 2), ' ')}
        width={BANDWIDTH_AVG}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={session_arrivals}
        width={SESSION_CNT_AVG}
        className={'align--end'}
      />
    </div>
  )
}

export default RouterTableRow
