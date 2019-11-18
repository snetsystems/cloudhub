import React, {PureComponent} from 'react'
import {ROUTER_TABLE_SIZING} from 'src/swan_sdplex/constants/tableSizing'
import {Router} from 'src/types'

interface Props {
  router: Router
}

const TableItem = ({width, title}) => {
  return (
    <div
      className="hosts-table--td"
      style={{width: width, alignItems: 'center'}}
    >
      {title}
    </div>
  )
}
class RouterTableRow extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  public focusedClasses = (): string => {
    return 'hosts-table--tr'
  }

  render() {
    const {
      assetID,
      routerStatus,
      networkStatus,
      ApplicationStatus,
      cpu,
      memory,
      sdplexTrafficUsage,
      config,
      firmware,
    } = this.props.router
    const {
      ASSETID,
      ROUTERSTATUS,
      NETWORKSTATUS,
      APPLICATIONSTATUS,
      CPU,
      MEMORY,
      SDPLEXTRAFFICUSAGE,
      CONFIG,
      FIRMWARE,
    } = ROUTER_TABLE_SIZING

    return (
      <div className="hosts-table--tr">
        <TableItem title={assetID} width={ASSETID} />
        <TableItem title={routerStatus} width={ROUTERSTATUS} />
        <TableItem title={networkStatus} width={NETWORKSTATUS} />
        <TableItem title={ApplicationStatus} width={APPLICATIONSTATUS} />
        <TableItem title={`${cpu}%`} width={CPU} />
        <TableItem title={`${memory}%`} width={MEMORY} />
        <TableItem
          title={`${sdplexTrafficUsage} Mbps`}
          width={SDPLEXTRAFFICUSAGE}
        />
        <TableItem title={config} width={CONFIG} />
        <button>Apply</button>
        <TableItem title={firmware} width={FIRMWARE} />
        <button>Apply</button>
      </div>
    )
  }
}

export default RouterTableRow
