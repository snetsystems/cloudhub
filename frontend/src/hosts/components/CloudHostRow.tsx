import React, {FunctionComponent} from 'react'
import {Link} from 'react-router'
import classnames from 'classnames'

import {CLOUD_HOSTS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {Host} from 'src/types'

import {HostsPage} from 'src/hosts/containers/HostsPage'

import {usageIndacator} from 'src/agent_admin/reusable'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'

interface Props {
  sourceID: string
  host: Host
  focusedHost: string
  onClickTableRow: HostsPage['handleClickTableRow']
}

const CloudHostRow: FunctionComponent<Props> = ({
  host,
  sourceID,
  focusedHost,
  onClickTableRow,
}) => {
  const {name, cpu, load, apps = []} = host
  const {
    CloudNameWidth,
    CloudInstanceIDWidth,
    CloudInstanceStateWidth,
    CloudInstanceTypeWidth,
    CloudStatusCheckWidth,
    CloudAlarmStatusWidth,
    CloudAppsWidth,
    CloudCPUWidth,
    CloudMemoryWidth,
    CloudDiskWidth,
  } = CLOUD_HOSTS_TABLE_SIZING

  const CPUValue = isNaN(cpu) ? 'N/A' : `${cpu.toFixed(2)}%`
  const loadValue = isNaN(load) ? 'N/A' : `${load.toFixed(2)}`
  const dotClassName = classnames(
    'table-dot',
    Math.max(host.deltaUptime || 0, host.winDeltaUptime || 0) > 0
      ? 'dot-success'
      : 'dot-critical'
  )

  const focusedClasses = (): string => {
    if (name === focusedHost) return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }

  return (
    <div className={focusedClasses()} onClick={onClickTableRow(name)}>
      <div className="hosts-table--td" style={{width: CloudNameWidth}}>
        <Link to={`/sources/${sourceID}/infrastructure/${name}`}>{name}</Link>
      </div>
      <div className="hosts-table--td" style={{width: CloudInstanceIDWidth}}>
        <div className={dotClassName} />
      </div>
      <div
        style={{width: CloudInstanceStateWidth}}
        className="monotype hosts-table--td"
      >
        {CPUValue}
      </div>
      <div
        style={{width: CloudInstanceTypeWidth}}
        className="monotype hosts-table--td"
      >
        {loadValue}
      </div>
      <div
        style={{width: CloudStatusCheckWidth}}
        className="monotype hosts-table--td"
      >
        {loadValue}
      </div>
      <div
        style={{width: CloudAlarmStatusWidth}}
        className="monotype hosts-table--td"
      >
        {loadValue}
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
        {usageIndacator({
          value: fixedDecimalPercentage(parseFloat(CPUValue), 2),
        })}
      </div>
      <div
        style={{width: CloudMemoryWidth}}
        className="monotype hosts-table--td"
      >
        {usageIndacator({
          value: fixedDecimalPercentage(parseFloat(CPUValue), 2),
        })}
      </div>
      <div style={{width: CloudDiskWidth}} className="monotype hosts-table--td">
        {usageIndacator({
          value: fixedDecimalPercentage(parseFloat(CPUValue), 2),
        })}
      </div>
    </div>
  )
}

export default CloudHostRow
