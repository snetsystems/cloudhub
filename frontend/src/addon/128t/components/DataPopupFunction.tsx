// Libraries
import React, {PureComponent, createRef} from 'react'

// Component
import DataPopup from 'src/addon/128t/components/DataPopup'

// Types
import {FluxToolbarFunction} from 'src/types/flux'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  func: FluxToolbarFunction
  onClickFunction: (funcName: string, funcExample: string) => void
}

interface State {
  isActive: boolean
  clickPosition: {top: number; right: number}
}

@ErrorHandling
class DataPopupFunction extends PureComponent<Props, State> {
  private functionRef = createRef<HTMLDivElement>()

  constructor(props: Props) {
    super(props)

    this.state = {isActive: false, clickPosition: undefined}
  }
  public render() {
    const {func} = this.props
    console.log('DataPopupFunction')
    return (
      <div
        className="flux-functions-toolbar--function"
        ref={this.functionRef}
        onMouseEnter={this.handleClick}
        onMouseLeave={this.handleBlur}
      >
        {this.tooltip}
        <dd onClick={this.handleClickFunction}>{func.name}</dd>
      </div>
    )
  }

  private get tooltip(): JSX.Element {
    if (this.state.isActive) {
      return (
        <DataPopup
          func={this.props.func}
          onDismiss={this.handleClick}
          tipPosition={this.state.clickPosition}
        />
      )
    }
  }

  private handleClick = () => {
    const {top, right} = this.functionRef.current.getBoundingClientRect()
    console.log(this.functionRef.current.getBoundingClientRect())
    console.log('window.innerWidth', window.innerWidth)
    console.log({top, right})
    // const left = right - window.innerWidth
    // console.log({left})
    this.setState({isActive: true, clickPosition: {top, right}})
  }

  private handleBlur = () => {
    this.setState({isActive: false})
  }

  private handleClickFunction = () => {
    const {func, onClickFunction} = this.props

    onClickFunction(func.name, func.example)
  }
}

export default DataPopupFunction
