import React from "react";
import ReactModal from "react-modal";

class AgentModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
      domObj: HTMLElement,
      target: {}
    };

    this.handleOpenModal = this.handleOpenModal.bind(this);
    this.handleCloseModal = this.handleCloseModal.bind(this);
    this.onClickAccept = this.onClickAccept.bind(this);
    this.onClickReject = this.onClickReject.bind(this);
    this.onClickDelete = this.onClickDelete.bind(this);
  }

  handleOpenModal(event) {
    event.stopPropagation();
    const { name } = this.props;
    event.target.innerText === name
      ? this.setState({
          showModal: true,
          target: event.target.getBoundingClientRect()
        })
      : this.setState({ showModal: true });
  }

  handleCloseModal() {
    this.setState({ showModal: false });
  }

  onClickAccept() {
    const { targetObject } = this.props;
    console.log("onClickAccept");
  }

  onClickReject() {
    const { targetObject } = this.props;
    console.log("onClickReject");
  }

  onClickDelete() {
    const { targetObject } = this.props;
    console.log("onClickDelete");
  }

  componentDidMount() {
    const { key } = this.props;
    ReactModal.setAppElement(`#table-row--select${key}`);
  }

  render() {
    const { name, isAccept } = this.props;
    const { target } = this.state;

    return (
      <button className="btn btn-default" onClick={this.handleOpenModal}>
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
              {isAccept === false ? (
                <div className="dropdown--item">
                  <div
                    className="dropdown-item--children"
                    onClick={this.onClickAccept}
                  >
                    Accept
                  </div>
                </div>
              ) : (
                <div className="dropdown--item">
                  <div
                    className="dropdown-item--children"
                    onClick={this.onClickReject}
                  >
                    Reject
                  </div>
                </div>
              )}

              <div className="dropdown--item">
                <div
                  className="dropdown-item--children"
                  onClick={this.onClickDelete}
                >
                  Delete
                </div>
              </div>
            </div>
          </div>
        </ReactModal>
      </button>
    );
  }
}

export default AgentModal;
