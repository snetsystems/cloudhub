// Libraries
import React from "react"

// Components
import ReactModal from "react-modal"

// Decorators
import { ErrorHandling } from 'src/shared/decorators/errors'

interface Props {
  name: string
  host: string
  status: string
  targetObject: HTMLElement
  idx: number
  handleWheelKeyCommand: (host: string, x: string) => void
}

interface State {
  target: { top: number, left: number }
  showModal: boolean
}

@ErrorHandling
class AgentMinionsModal extends React.Component<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      showModal: false,
      target: { top: null, left: null }
    }

    this.handleOpenModal = this.handleOpenModal.bind(this)
    this.handleCloseModal = this.handleCloseModal.bind(this)
    this.onClickAccept = this.onClickAccept.bind(this)
    this.onClickReject = this.onClickReject.bind(this)
    this.onClickDelete = this.onClickDelete.bind(this)
  }

  handleOpenModal(event) {
    event.stopPropagation()
    const { name } = this.props
    event.target.innerText === name
      ? this.setState({
        showModal: true,
        target: event.target.getBoundingClientRect()
      })
      : this.setState({ showModal: true })
  }

  handleCloseModal() {
    this.setState({ showModal: false })
  }

  componentDidMount() {
    const { idx } = this.props
    ReactModal.setAppElement(`#table-row--select${idx}`)
  }

  onClickAccept(event) {
    const { handleWheelKeyCommand, host } = this.props
    handleWheelKeyCommand(host, "Accept")
    event.stopPropagation()
    this.handleCloseModal()
  }

  onClickReject(event) {
    const { handleWheelKeyCommand, host } = this.props
    handleWheelKeyCommand(host, "ReJect")
    event.stopPropagation()
    this.handleCloseModal()
  }

  onClickDelete(event) {
    const { handleWheelKeyCommand, host } = this.props
    handleWheelKeyCommand(host, "Delete")
    event.stopPropagation()
    this.handleCloseModal()
  }

  render() {
    const { name, status } = this.props
    const { target } = this.state

    return (
      <button
        className="btn btn-default"
        onClick={this.handleOpenModal}
        style={{
          fontSize: "24px"
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
              width: "11.5vw",
              position: "absolute",
              top: target.top,
              left: target.left
            }}
            onMouseLeave={this.handleCloseModal}
          >
            <div className="dropdown--menu">
              {status === "UnAccept" || status === "ReJect" ? (
                <div className="dropdown--item" onClick={this.onClickAccept}>
                  <div className="dropdown-item--children">Accept</div>
                </div>
              ) : (
                  <div className="dropdown--item" onClick={this.onClickReject}>
                    <div className="dropdown-item--children">Reject</div>
                  </div>
                )}

              <div className="dropdown--item" onClick={this.onClickDelete}>
                <div className="dropdown-item--children">Delete</div>
              </div>
            </div>
          </div>
        </ReactModal>
      </button>
    )
  }
}

export default AgentMinionsModal
