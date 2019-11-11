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

  render() {
    const {name, focusedMeasure} = this.props
    return (
      <div
        className="query-builder--list-item"
        style={{position: 'relative'}}
        onClick={focusedMeasure}
      >
        {`${name}`}
        <button
          ref={this.functionRef}
          className="btn btn-primary"
          onClick={this.handleClick.bind(this)}
        >
          help
        </button>
        {this.tooltip}
      </div>
    )
  }

  private handleClick = () => {
    const {isActive} = this.state
    const {
      top,
      right,
      width,
      left,
    } = this.functionRef.current.getBoundingClientRect()
    console.log(this.functionRef.current.getBoundingClientRect())
    const calcPosition = window.innerWidth - right
    isActive
      ? this.setState({isActive: false})
      : this.setState({
          isActive: true,
          clickPosition: {top, right: calcPosition},
        })
  }

  private handleOtherClick = () => {
    this.setState({isActive: false})
  }

  private get tooltip(): JSX.Element {
    if (this.state.isActive) {
      const dummy = {desc: 123, args: 456, example: 678, link: '@link'}
      console.log(this.state.clickPosition)
      return (
        <FunctionTooltip
          func={dummy}
          onDismiss={this.handleOtherClick}
          tipPosition={this.state.clickPosition}
          caretLeft={true}
        />
      )
    }
  }
}

export default AgentToolbarFunction
