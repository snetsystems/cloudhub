import React, {PureComponent} from 'react'
import _ from 'lodash'
import AgentTooltip from 'src/agent_admin/components/AgentTooltip'
import {ErrorHandling} from 'src/shared/decorators/errors'

@ErrorHandling
class AgentToolbarFunction extends PureComponent {
  private functionRef = React.createRef()
  constructor(props) {
    super(props)
    this.state = {
      isActive: props.isActivity,
    }
  }

  componentWillReceiveProps(newProps) {
    if (this.state.isActive !== newProps.isActivity) {
      this.setState({isActive: newProps.isActivity})
    }
  }

  componentWillUnmount() {}

  render() {
    const {name, isActivity} = this.props
    return (
      <>
        <div
          className="query-builder--list-item"
          style={{position: 'relative'}}
        >
          {`${name}`}
          <button
            className={
              isActivity
                ? 'btn btn-primary item active'
                : 'btn btn-primary item'
            }
            onClick={this.handleFocusing.bind(this)}
            ref={this.functionRef}
          >
            {`>>`}
          </button>
        </div>
        {this.tooltip}
      </>
    )
  }

  private handleFocusing = () => {
    const {handleFocusedMeasure} = this.props
    const clickPosition = this.functionRef.current.getBoundingClientRect()
    console.log({clickPosition})
    handleFocusedMeasure({clickPosition, _thisProps: this.props})
  }

  private get tooltip(): JSX.Element {
    const {focusedPosition, handleClose, description} = this.props
    if (this.state.isActive) {
      return (
        <AgentTooltip
          description={description}
          onDismiss={handleClose}
          tipPosition={focusedPosition}
        />
      )
    }
  }
}

export default AgentToolbarFunction
