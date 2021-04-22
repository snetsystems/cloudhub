import React, {MouseEvent} from 'react'
import classnames from 'classnames'
import {unitIndicator, usageIndacator} from 'src/addon/128t/reusable'
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants'
import {
  RouterNode,
  TopSource,
  TopSession,
  OncueData,
} from 'src/addon/128t/types'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'
import {transBps} from 'src/shared/utils/units'
import {TableBodyRowItem} from 'src/addon/128t/reusable/layout'
import GeoLocationIndicator from 'src/addon/128t/components/GeoLocationIndicator'
import {ShellInfo} from 'src/types'

interface Props {
  isCheck: boolean
  handleRouterCheck: ({routerNode: RouterNode}) => void
  routerNode: RouterNode
  focusedNodeName: string
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedNodeName: string
  ) => () => void
  handleOnClickNodeName: (data: {
    _event: MouseEvent<HTMLElement>
    routerNode: RouterNode
  }) => void
  oncueData: OncueData
  handleOnClickShellModalOpen: (shell: ShellInfo) => void
}

const RouterTableRow = ({
  handleRouterCheck,
  onClickTableRow,
  focusedNodeName,
  routerNode,
  isCheck,
  handleOnClickNodeName,
  handleOnClickShellModalOpen,
  oncueData,
}: Props) => {
  const {
    group,
    nodeName,
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
    deltaUptime,
    winDeltaUptime,
  } = routerNode

  const {
    NODENAME,
    GROUP,
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

  const focusedClasses = (nodeName: RouterNode['nodeName']): string => {
    if (nodeName === focusedNodeName)
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

  const enabledIndicator = (enabled: RouterNode['enabled']): JSX.Element => {
    return responseIndicator(enabled)
  }

  const connectedIndicator = (
    managementConnected: RouterNode['managementConnected']
  ): JSX.Element => {
    return responseIndicator(managementConnected)
  }

  const geoLocationIndicatorCall = (
    locationCoordinates: RouterNode['locationCoordinates']
  ): JSX.Element => {
    return locationCoordinates ? (
      <GeoLocationIndicator locationCoordinates={locationCoordinates} />
    ) : (
      <div>-</div>
    )
  }

  const getHandleRouterCheck = (event: MouseEvent) => {
    event.stopPropagation()
    handleRouterCheck({routerNode})
  }

  const getHandleOnClickNodeName = ({
    _event,
    routerNode,
  }: {
    _event: MouseEvent<HTMLDivElement>
    routerNode: RouterNode
  }) => {
    handleOnClickNodeName({_event, routerNode})
    _event.stopPropagation()
  }

  return (
    <div
      className={focusedClasses(routerNode.nodeName)}
      onClick={onClickTableRow(topSources, topSessions, nodeName)}
    >
      <TableBodyRowItem
        title={
          <div className="dark-checkbox">
            <input
              id={`router-table--${nodeName}-${group}`}
              type="checkbox"
              checked={isCheck}
              onClick={getHandleRouterCheck.bind(routerNode)}
              readOnly
            />
            <label htmlFor={`router-table--${nodeName}-${group}`} />
          </div>
        }
        width={CHECKBOX}
      />
      <TableBodyRowItem
        title={
          <div
            onClick={(event: MouseEvent<HTMLDivElement>): void => {
              getHandleOnClickNodeName({_event: event, routerNode})
            }}
            className={`cursor--pointer`}
            style={{width: '100%'}}
          >
            <div
              className={classnames(
                '',
                Math.max(deltaUptime || 0, winDeltaUptime || 0) > 0 ||
                  group === 'root'
                  ? {
                      'hosts-table-item': oncueData.isOncue,
                      focused:
                        oncueData.isOncue && oncueData.nodeName === nodeName,
                    }
                  : {}
              )}
            >
              {nodeName}
            </div>
          </div>
        }
        width={NODENAME}
      />

      <TableBodyRowItem title={group !== 'root' ? group : '-'} width={GROUP} />
      <TableBodyRowItem
        title={
          ipAddress ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <div>{ipAddress}</div>
              <button
                className="btn btn-sm btn-default btn-square icon bash agent-row--button-sm"
                title={'Open SSH Terminal'}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOnClickShellModalOpen({
                    isNewEditor: false,
                    addr: ipAddress,
                    nodename: nodeName,
                  })
                }}
                style={{fontSize: '10px'}}
              ></button>
            </div>
          ) : null
        }
        width={IPADDRESS}
      />
      <TableBodyRowItem title={role} width={ROLE} />
      <TableBodyRowItem
        title={enabledIndicator(routerNode.enabled)}
        width={ENABLED}
        className={'align--start'}
      />

      <TableBodyRowItem
        title={geoLocationIndicatorCall(locationCoordinates)}
        width={LOCATIONCOORDINATES}
      />
      <TableBodyRowItem
        title={connectedIndicator(routerNode.managementConnected)}
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
