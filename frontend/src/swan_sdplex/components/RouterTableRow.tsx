import React, {PureComponent} from 'react'
import {ROUTER_TABLE_SIZING} from 'src/swan_sdplex/constants/tableSizing'
import {Router} from 'src/types'

interface Props {
  router: Router
  onClickModal: ({name, _this, onClickfn}) => JSX.Element
}

interface State {
  showModal: boolean
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

class RouterTableRow extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      showModal: false,
    }
  }

  public focusedClasses = (): string => {
    return 'hosts-table--tr'
  }

  public onClickApplybuttonShow = () => {
    console.log('onClickApplybuttonShow-1')
    // this.setState({
    //   showModal: true,
    // })

    // return (
    //   <ReactModal
    //     isOpen={this.state.showModal}
    //     className="Modal"
    //     contentLabel="Minimal Modal Example"
    //     overlayClassName="Overlay"
    //   >
    //     <button onClick={this.onClickApplybuttonHide}>hide</button>
    //   </ReactModal>
    // )
  }
  render() {
    const {onClickModal} = this.props
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
      <div className={this.focusedClasses()}>
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
        <div className="hosts-table--td" style={{width: CONFIG}}>
          <TableItem title={config} width={'85%'} />
          {onClickModal({
            name: 'Deploy',
            _this: this,
            onClickfn: this.onClickApplybuttonShow,
          })}
        </div>
        <div
          className="hosts-table--td"
          id={`table-row--apply`}
          style={{width: FIRMWARE}}
        >
          <TableItem title={firmware} width={'85%'} />
          {onClickModal({
            name: 'Deploy',
            _this: this,
            onClickfn: this.onClickApplybuttonShow,
          })}
        </div>
      </div>
    )
  }

  public onClickApplybuttonHide = () => {
    this.setState({
      showModal: false,
    })
  }
}

export default RouterTableRow
