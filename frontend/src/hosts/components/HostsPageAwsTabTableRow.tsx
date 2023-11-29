// Libraries
import {isNull} from 'lodash'
import React, {FunctionComponent} from 'react'
import _ from 'lodash'
import {Link} from 'react-router'

//types
import {CLOUD_HOSTS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {CloudHost} from 'src/types'

//Components
import {usageIndacator} from 'src/agent_admin/reusable'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'
import classNames from 'classnames'
import {HostsPageAwsTab} from 'src/hosts/containers/HostsPageAwsTab'

//Constants
import {NOT_AVAILABLE_STATUS} from 'src/hosts/constants/topology'

interface Instance {
  provider: string
  namespace: string
  instanceid: string
  instancename: string
}
interface Props {
  sourceID: string
  host: CloudHost
  focusedInstance: Instance
  onClickTableRow: HostsPageAwsTab['handleClickCspTableRow']
  handleInstanceTypeModal: (
    provider: string,
    namespace: string,
    type: string
  ) => void
}

const HostsPageAwsTabTableRow: FunctionComponent<Props> = ({
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
    CloudNamespaceWidth,
    CloudNameWidth,
    CloudInstanceIDWidth,
    CloudInstanceStateWidth,
    CloudInstanceTypeWidth,
    CloudAppsWidth,
    CloudCPUWidth,
    CloudMemoryWidth,
    CloudDiskWidth,
  } = CLOUD_HOSTS_TABLE_SIZING

  const cpuValue =
    isNaN(cpu) || isNull(cpu) ? NOT_AVAILABLE_STATUS : `${cpu.toFixed(2)}%`
  const memoryValue =
    isNaN(memory) || isNull(memory)
      ? NOT_AVAILABLE_STATUS
      : `${memory.toFixed(2)}`
  const diskValue =
    isNaN(disk) || isNull(disk) ? NOT_AVAILABLE_STATUS : `${disk.toFixed(2)}`

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
        namespace: csp.namespace,
        instanceid: instanceId,
        instancename: name,
      })}
    >
      <div className="hosts-table--td" style={{width: CloudNamespaceWidth}}>
        {csp.namespace}
      </div>
      <div className="hosts-table--td" style={{width: CloudNameWidth}}>
        <Link to={`/sources/${sourceID}/infrastructure/details/${name}`}>
          {name}
        </Link>
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
        className="monotype hosts-table--td"
      >
        <span
          className={`hosts-table-item`}
          onClick={e => {
            e.stopPropagation()
            handleInstanceTypeModal(csp.provider, csp.namespace, instanceType)
          }}
        >
          {instanceType}
        </span>
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
                  pathname: `/sources/${sourceID}/infrastructure/details/${name}`,
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
        {(cpuValue === NOT_AVAILABLE_STATUS && cpuValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(cpuValue), 2),
          })}
      </div>
      <div
        style={{width: CloudMemoryWidth}}
        className="monotype hosts-table--td"
      >
        {(memoryValue === NOT_AVAILABLE_STATUS && memoryValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(memoryValue), 2),
          })}
      </div>
      <div style={{width: CloudDiskWidth}} className="monotype hosts-table--td">
        {(diskValue === NOT_AVAILABLE_STATUS && diskValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(diskValue), 2),
          })}
      </div>
    </div>
  )
}

export default HostsPageAwsTabTableRow
