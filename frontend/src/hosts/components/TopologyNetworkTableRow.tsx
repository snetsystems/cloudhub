import React, {PureComponent} from 'react'

import {cspNetwork} from 'src/hosts/types/cloud'
import {CLOUD_HOST_NETWORK_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  rowData: cspNetwork
}

class TopologyNetworkTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      rowData: {name, internal_ip, external_ip, tier, type},
    } = this.props
    const {
      NameWidth,
      InternalipWidth,
      ExternalipWidth,
      TierWidth,
      TypeWidth,
    } = CLOUD_HOST_NETWORK_TABLE_SIZING

    return (
      <>
        <div className={`hosts-table--tr`}>
          <div className="hosts-table--td" style={{width: NameWidth}}>
            {name}
          </div>
          <div className="hosts-table--td" style={{width: InternalipWidth}}>
            {internal_ip}
          </div>
          <div
            className="monotype hosts-table--td"
            style={{width: ExternalipWidth}}
          >
            {external_ip}
          </div>
          <div className="monotype hosts-table--td" style={{width: TierWidth}}>
            {tier}
          </div>
          <div className="monotype hosts-table--td" style={{width: TypeWidth}}>
            {type}
          </div>
        </div>
      </>
    )
  }
}

export default TopologyNetworkTableRow
