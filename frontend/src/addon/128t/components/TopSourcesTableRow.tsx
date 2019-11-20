import React, {PureComponent} from 'react'
import {TOPSOURCES_TABLE_SIZING} from 'src/addon/128t/constants/tableSizing'
import {TopSources} from 'src/types'

interface Props {
  topSources: TopSources
}

interface State {
  showModal: boolean
}

const TableItem = ({width, title}) => {
  return (
    <div
      className="hosts-table--td"
      style={{width: width, alignItems: 'center', lineHeight: '200%'}}
    >
      {title}
    </div>
  )
}

class TopSourcesTableRow extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      showModal: false,
    }
  }

  public focusedClasses = (): string => {
    return 'hosts-table--tr'
  }

  render() {
    const {
      ip,
      tenant,
      currentBandwidth,
      totalData,
      sessionCount,
    } = this.props.topSources

    const {
      IP,
      TENANT,
      CURRENTBANDWIDTH,
      TOTALDATA,
      SESSIONCOUNT,
    } = TOPSOURCES_TABLE_SIZING

    return (
      <div className={this.focusedClasses()}>
        <TableItem title={ip} width={IP} />
        <TableItem title={tenant} width={TENANT} />
        <TableItem title={currentBandwidth} width={CURRENTBANDWIDTH} />
        <TableItem title={totalData} width={TOTALDATA} />
        <TableItem title={sessionCount} width={SESSIONCOUNT} />
      </div>
    )
  }

  public onClickApplybuttonHide = () => {
    this.setState({
      showModal: false,
    })
  }
}

export default TopSourcesTableRow
