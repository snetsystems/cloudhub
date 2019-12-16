import React from 'react'
import ReactModal from 'react-modal'

interface Props {
  name: any
  targetObject: any
  onClickfn: any
}

interface State {
  showModal: boolean
  domObj: any
  target: any
}

class RouterModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      showModal: false,
      domObj: HTMLElement,
      target: {},
    }

    this.handleOpenModal = this.handleOpenModal.bind(this)
    this.handleCloseModal = this.handleCloseModal.bind(this)
    this.onClickAccept = this.onClickAccept.bind(this)
  }

  handleOpenModal(e) {
    const {name} = this.props
    e.target.innerText === name
      ? this.setState({
          showModal: true,
          target: e.target.getBoundingClientRect(),
        })
      : this.setState({showModal: true})
  }

  handleCloseModal() {
    this.setState({showModal: false})
  }

  componentDidMount() {
    ReactModal.setAppElement(`#table-row--apply`)
  }

  onClickAccept(e) {
    const {targetObject} = this.props
    return console.log('onClickAccept', e, {...targetObject.props.minion})
  }

  public onClickA = () => {
    // parent's fnc
    const {onClickfn} = this.props

    onClickfn()
    this.setState({showModal: false})
  }

  render() {
    const {name} = this.props
    const {target} = this.state

    return (
      <button
        className="btn btn-default"
        onClickCapture={this.handleOpenModal}
        onMouseLeave={this.handleCloseModal}
        style={{
          height: '23px',
          lineHeight: '23px',
          fontSize: '12px',
          minWidth: '65px',
        }}
      >
        {name}
        <ReactModal
          isOpen={this.state.showModal}
          onRequestClose={this.handleCloseModal}
          className="Modal"
          overlayClassName="Overlay"
        >
          <div
            className="dropdown--menu-container dropdown--sapphire"
            style={{
              width: '8vw',
              position: 'absolute',
              top: target.top - 10,
              left: target.left + 25,
            }}
            // onMouseLeave={this.handleCloseModal}
          >
            <div className="dropdown--menu">
              <div className="dropdown--item">
                <div
                  className="dropdown-item--children"
                  // onClick={onClickAccept}
                  onClick={this.onClickA}
                  style={{
                    textAlign: 'center',
                  }}
                >
                  Apply
                </div>
              </div>
            </div>
          </div>
        </ReactModal>
      </button>
    )
  }
}

export default RouterModal
