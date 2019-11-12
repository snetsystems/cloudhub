import React, {PureComponent} from 'react'

import FunctionTooltip from 'src/flux/components/flux_functions_toolbar/FunctionTooltip'

import {ErrorHandling} from 'src/shared/decorators/errors'

@ErrorHandling
class AgentToolbarFunction extends PureComponent {
  private functionRef = React.createRef()
  constructor(props) {
    super(props)
    this.state = {
      isActive: false,
      clickPosition: undefined,
    }
  }

  public componentWillReceiveProps(newProps) {
    if (newProps.refresh) {
      const boolean = newProps.focusedMeasure === this.functionRef.current
      this.setState({isActive: boolean})
    }
  }

  render() {
    const {name, handleFocusedMeasure, focusedMeasure, idx} = this.props
    return (
      <div className="query-builder--list-item" style={{position: 'relative'}}>
        {`${name}`}
        <button
          ref={this.functionRef}
          className={'btn btn-primary item' + idx}
          onClick={this.handleFocusing.bind(this)}
        >
          {`help ${idx}`}
        </button>
        {this.tooltip}
      </div>
    )
  }

  private handleFocusing = () => {
    const clickPosition = this.functionRef.current.getBoundingClientRect()
    this.props.handleFocusedMeasure({clickPosition, refresh: true})
  }

  private handleOtherClick = () => {
    this.setState({isActive: false})
    this.props.handleFocusedMeasure({refresh: false})
  }

  private get tooltip(): JSX.Element {
    const {focusedPosition} = this.props
    if (this.state.isActive) {
      const dummy = {desc: 123, args: 456, example: 678, link: '@link'}
      return (
        <FunctionTooltip
          func={dummy}
          onDismiss={this.handleOtherClick}
          tipPosition={focusedPosition}
          pivot={'left'}
        />
      )
    }
  }
}

export default AgentToolbarFunction
