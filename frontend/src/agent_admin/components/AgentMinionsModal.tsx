// Libraries
import React, {PureComponent, MouseEvent} from 'react'

// Components
import ReactModal from 'react-modal'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {MinionState} from 'src/agent_admin/type/minion'

interface Props {
  name: string
  host: string
  status: string
  targetObject: HTMLElement
  idx: number
  handleWheelKeyCommand: (host: string, x: string) => void
}

interface State {
  target: {top: number; left: number}
  showModal: boolean
}

@ErrorHandling
class AgentMinionsModal extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      showModal: false,
      target: {top: null, left: null},
    }
  }

  public handleOpenModal = event => {
    event.stopPropagation()
    const {name} = this.props
    event.target.innerText === name
      ? this.setState({
          showModal: true,
          target: event.target.getBoundingClientRect(),
        })
      : this.setState({showModal: true})
  }

  public handleCloseModal = () => {
    this.setState({showModal: false})
  }

  public componentDidMount = () => {
    const {idx} = this.props
    ReactModal.setAppElement(`#table-row--select${idx}`)
  }

  public onClickAccept = (event: MouseEvent<HTMLElement>) => {
    const {handleWheelKeyCommand, host} = this.props
    handleWheelKeyCommand(host, MinionState.Accept)
    event.stopPropagation()
    this.handleCloseModal()
  }

  public onClickReject = (event: MouseEvent<HTMLElement>) => {
    const {handleWheelKeyCommand, host} = this.props
    handleWheelKeyCommand(host, MinionState.Reject)
    event.stopPropagation()
    this.handleCloseModal()
  }

  public onClickDelete = (event: MouseEvent<HTMLElement>) => {
    const {handleWheelKeyCommand, host} = this.props
    handleWheelKeyCommand(host, MinionState.Delete)
    event.stopPropagation()
    this.handleCloseModal()
  }

  public render() {
    const {name, status} = this.props
    const {target} = this.state

    return (
      <button
        className="btn btn-default"
        onClick={this.handleOpenModal}
        style={{
          fontSize: '24px',
        }}
      >
        {name}
        <ReactModal
          isOpen={this.state.showModal}
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
            }}
            onMouseLeave={this.handleCloseModal}
          >
            <div className="dropdown--menu">
              {status === MinionState.Denied ? (
                <div className="dropdown--item" onClick={this.onClickDelete}>
                  <div className="dropdown-item--children">Delete</div>
                </div>
              ) : (
                <>
                  {status === MinionState.UnAccept ||
                  status === MinionState.Reject ? (
                    <div
                      className="dropdown--item"
                      onClick={this.onClickAccept}
                    >
                      <div className="dropdown-item--children">Accept</div>
                    </div>
                  ) : (
                    <div
                      className="dropdown--item"
                      onClick={this.onClickReject}
                    >
                      <div className="dropdown-item--children">Reject</div>
                    </div>
                  )}

                  <div className="dropdown--item" onClick={this.onClickDelete}>
                    <div className="dropdown-item--children">Delete</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </ReactModal>
      </button>
    )
  }
}

export default AgentMinionsModal
