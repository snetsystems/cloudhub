// Libraries
import React, {PureComponent, createRef} from 'react'

// Component
import DataPopup from 'src/addon/128t/components/DataPopup'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  handleOnClick: () => void
  handleOnMouseLeave: () => void
  hanldeOnDismiss: () => void
  data: {name: string}
  popupPosition: {top: number; right: number}
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
    this.state = {
      isActive: false,
      clickPosition: {top: null, right: null},
    }
  }

  public render() {
    const {data} = this.props
    console.log('DataPopupFunction')
    return (
      <div
        className="flux-functions-toolbar--function"
        ref={this.functionRef}
        onClick={this.handleClick}
        onMouseLeave={this.handleStopHover}
      >
        {this.tooltip}
        <dd onClick={this.handleClickFunction}>{data.name}</dd>
      </div>
    )
  }

  private get tooltip(): JSX.Element {
    if (this.state.isActive) {
      return (
        <DataPopup
          data={this.props.data}
          onDismiss={this.handleStopHover}
          // hanldeOnDismiss={this.props.hanldeOnDismiss}
          popupPosition={this.state.clickPosition}
        />
      )
    }
  }

  private handleClick = e => {
    const {top, right} = this.functionRef.current.getBoundingClientRect()
    console.log(e.target.getBoundingClientRect())
    console.log('tooltip', {top, right})
    // const left = right - window.innerWidth
    // console.log({left})
    this.setState({isActive: true, clickPosition: {top, right}})
  }

  private handleStopHover = () => {
    this.setState({isActive: false})
  }

  // private handleBlur = () => {
  //   this.setState({isActive: false})
  // }

  private handleClickFunction = () => {
    const {data} = this.props

    // onClickFunction(func.name, func.example)
  }
}

export default DataPopupFunction
