import {isNull} from 'lodash'
import React, {FunctionComponent} from 'react'
import _ from 'lodash'
import {Link} from 'react-router'

import {CLOUD_HOSTS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {CloudHost} from 'src/types'

import {HostsPage} from 'src/hosts/containers/HostsPage'

import {usageIndacator} from 'src/agent_admin/reusable'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'
import classNames from 'classnames'

interface Instance {
  provider: string
  region: string
  instanceid: string
  instancename: string
}
interface Props {
  sourceID: string
  host: CloudHost
  focusedInstance: Instance
  onClickTableRow: HostsPage['handleClickCspTableRow']
  handleInstanceTypeModal: (
    provider: string,
    region: string,
    type: string
  ) => void
}

const CspHostRow: FunctionComponent<Props> = ({
  host,
  sourceID,
  focusedInstance,
  onClickTableRow,
  handleInstanceTypeModal,
}) => {
  const {
    csp,
    instanceId,
    instanceType,
    instanceState,
    name,
    cpu,
    disk,
    memory,
    apps = [],
  } = host

  const {
    CloudRegionWidth,
    CloudNameWidth,
    CloudInstanceIDWidth,
    CloudInstanceStateWidth,
    CloudInstanceTypeWidth,
    CloudAppsWidth,
    CloudCPUWidth,
    CloudMemoryWidth,
    CloudDiskWidth,
  } = CLOUD_HOSTS_TABLE_SIZING

  const cpuValue = isNaN(cpu) || isNull(cpu) ? 'N/A' : `${cpu.toFixed(2)}%`
  const memoryValue =
    isNaN(memory) || isNull(memory) ? 'N/A' : `${memory.toFixed(2)}`
  const diskValue = isNaN(disk) || isNull(disk) ? 'N/A' : `${disk.toFixed(2)}`

  const focusedClasses = (): string => {
    if (name === _.get(focusedInstance, 'instancename'))
      return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }

  return (
    <div
      className={focusedClasses()}
      onClick={onClickTableRow({
        provider: csp.provider,
        region: csp.region,
        instanceid: instanceId,
        instancename: name,
      })}
    >
      <div className="hosts-table--td" style={{width: CloudRegionWidth}}>
        {csp.region}
      </div>
      <div className="hosts-table--td" style={{width: CloudNameWidth}}>
        <Link to={`/sources/${sourceID}/infrastructure/${name}`}>{name}</Link>
      </div>
      <div className="hosts-table--td" style={{width: CloudInstanceIDWidth}}>
        {instanceId}
      </div>
      <div
        style={{width: CloudInstanceStateWidth}}
        className="monotype hosts-table--td"
      >
        <div
          className={classNames(`status-tip`, {
            active: instanceState === 'running',
          })}
        >
          <div className={'status-tip-bg'}>
            <span className={'icon checkmark'}></span>
          </div>
          {instanceState}
        </div>
      </div>
      <div
        style={{width: CloudInstanceTypeWidth}}
        className="monotype hosts-table--td hosts-table-item"
        onClick={e => {
          e.stopPropagation()
          handleInstanceTypeModal(csp.provider, csp.region, instanceType)
        }}
      >
        {instanceType}
      </div>
      <div
        style={{width: CloudAppsWidth}}
        className="hosts-table--td list-type"
      >
        {apps.map((app, index) => {
          return (
            <span key={app}>
              <Link
                style={{marginLeft: '2px'}}
                to={{
                  pathname: `/sources/${sourceID}/infrastructure/${name}`,
                  query: {app},
                }}
              >
                {app}
              </Link>
              {index === apps.length - 1 ? null : ', '}
            </span>
          )
        })}
      </div>
      <div style={{width: CloudCPUWidth}} className="monotype hosts-table--td">
        {(cpuValue === 'N/A' && cpuValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(cpuValue), 2),
          })}
      </div>
      <div
        style={{width: CloudMemoryWidth}}
        className="monotype hosts-table--td"
      >
        {(memoryValue === 'N/A' && memoryValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(memoryValue), 2),
          })}
      </div>
      <div style={{width: CloudDiskWidth}} className="monotype hosts-table--td">
        {(diskValue === 'N/A' && diskValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(diskValue), 2),
          })}
      </div>
    </div>
  )
}

export default CspHostRow
