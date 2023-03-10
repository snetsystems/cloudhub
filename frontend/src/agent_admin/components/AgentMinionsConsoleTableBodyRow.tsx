// Libraries
import React, {PureComponent, MouseEvent} from 'react'

// Components
import ReactModal from 'react-modal'
import TooltipButton from 'src/shared/components/TooltipButton'
import AgentConnect from 'src/agent_admin/components/AgentConnect'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

//Types
import {ShellInfo} from 'src/types'

interface Props {
  name: string
  host: string
  idx: number
  os: string
  ip: string
  targetObject: HTMLElement
  handleShellModalOpen?: (shell: ShellInfo) => void
  handleShellModalClose?: () => void
}

interface State {
  target: {top: number; left: number}
  showModal: boolean
}

@ErrorHandling
class AgentMinionsConsoleTableBodyRow extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      showModal: false,
      target: {top: null, left: null},
    }
  }

  public handleOpenModal = event => {
    const {ip} = this.props
    const minionIPAddresses = ip.split(',')
    const isSingleIPAddress = ip === '' || minionIPAddresses.length < 2

    event.stopPropagation()

    if (isSingleIPAddress) {
      this.handleSingleIPAddress(ip)
      return
    }

    this.setState({
      showModal: true,
      target: event.target.getBoundingClientRect(),
    })
  }

  public handleSingleIPAddress = selectedIPAddress => {
    const {os, host, handleShellModalOpen} = this.props

    if (os && os.toLocaleLowerCase() === 'windows') {
      window.location.href =
        'rdp://' + selectedIPAddress + '/?admin=&span=&w=1280&h=800'
    } else {
      handleShellModalOpen({
        isNewEditor: false,
        addr: selectedIPAddress,
        nodename: host,
      })
    }

    this.handleCloseModal()
  }

  public handleMultipleIPDropDown = (
    event: MouseEvent<HTMLElement>,
    selectedIPAddress
  ) => {
    event.stopPropagation()

    const {os, host, handleShellModalOpen} = this.props

    if (os && os.toLocaleLowerCase() === 'windows') {
      window.location.href =
        'rdp://' + selectedIPAddress + '/?admin=&span=&w=1280&h=800'
    } else {
      handleShellModalOpen({
        isNewEditor: false,
        addr: selectedIPAddress,
        nodename: host,
      })
    }

    this.handleCloseModal()
  }

  public handleCloseModal = () => {
    this.setState({showModal: false})
  }

  public componentDidMount = () => {
    const {idx} = this.props
    ReactModal.setAppElement(`#table-row--select-ip${idx}`)
  }

  public render() {
    const {os, ip} = this.props

    return (
      <>
        {this.IPSelectDropdown}
        {os && os.toLocaleLowerCase() === 'windows' ? (
          ip ? (
            <button
              className="btn btn-sm btn-default icon computer-desktop agent-row--button-sm"
              title={'Open Remote Desktop'}
              onClick={this.handleOpenModal}
            ></button>
          ) : (
            <TooltipButton
              icon="computer-desktop"
              isEventStopPropagation={true}
              customClass={'agent-row--button-sm'}
              title={'Open Remote Desktop'}
            >
              <AgentConnect />
            </TooltipButton>
          )
        ) : (
          <button
            className="btn btn-sm btn-default icon bash agent-row--button-sm"
            title={'Open SSH Terminal'}
            onClick={this.handleOpenModal}
          ></button>
        )}
      </>
    )
  }

  private get IPSelectDropdown() {
    const {ip} = this.props
    const {target, showModal} = this.state
    const minionIPAddresses = ip.split(',')

    return (
      <ReactModal
        isOpen={showModal}
        contentLabel="collector table row modal"
        onRequestClose={this.handleCloseModal}
        className="Modal"
        overlayClassName="Overlay"
      >
        <div
          className="dropdown--menu-container dropdown--sapphire"
          style={{
            width: '11.5vw',
            position: 'absolute',
            top: target.top,
            left: target.left,
            maxWidth: '6.5rem',
            minWidth: '6.3rem',
          }}
          onMouseLeave={this.handleCloseModal}
        >
          <div className="dropdown--menu">
            {minionIPAddresses.map(ipAddress => (
              <div
                key={ipAddress}
                style={{fontWeight: 500}}
                className="dropdown--item"
                onClick={e => this.handleMultipleIPDropDown(e, ipAddress)}
              >
                <div className="dropdown-item--children">{ipAddress}</div>
              </div>
            ))}
          </div>
        </div>
      </ReactModal>
    )
  }
}

export default AgentMinionsConsoleTableBodyRow
