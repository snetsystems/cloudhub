// Libraries
import React, {PureComponent, MouseEvent, CSSProperties, createRef} from 'react'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
// import TooltipDescription from 'src/flux/components/flux_functions_toolbar/TooltipDescription'
// import TooltipArguments from 'src/flux/components/flux_functions_toolbar/TooltipArguments'
// import TooltipExample from 'src/flux/components/flux_functions_toolbar/TooltipExample'
// import TooltipLink from 'src/flux/components/flux_functions_toolbar/TooltipLink'

// Types
import {FluxToolbarFunction} from 'src/types/flux'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  func: FluxToolbarFunction
  onDismiss: () => void
  tipPosition?: {top: number; right: number}
}

interface State {
  bottomPosition: number | null
}

const MAX_HEIGHT = 400

@ErrorHandling
class DataPopup extends PureComponent<Props, State> {
  private tooltipRef = createRef<HTMLDivElement>()

  public constructor(props: Props) {
    super(props)
    this.state = {bottomPosition: null}
  }

  public componentDidMount() {
    const {top, height} = this.tooltipRef.current.getBoundingClientRect()
    console.log('DataPopup', this.tooltipRef.current.getBoundingClientRect())
    // if (bottom > window.innerHeight) {
    //   this.setState({bottomPosition: height / 2})
    // }
  }

  public render() {
    const {
      //   func: {desc, args, example, link},
    } = this.props

    return (
      <>
        <div
          style={this.stylePosition}
          className={this.handleToolTipClassName}
          ref={this.tooltipRef}
        >
          <button
            className="flux-functions-toolbar--tooltip-dismiss"
            onClick={this.handleDismiss}
          />{' '}
          <div className="flux-functions-toolbar--tooltip-contents">
            <FancyScrollbar
              autoHeight={true}
              maxHeight={MAX_HEIGHT}
              autoHide={false}
            >
              hello pop data
              {/* <TooltipDescription description={desc} />
              <TooltipArguments argsList={args} />
              <TooltipExample example={example} />
              <TooltipLink link={link} /> */}
            </FancyScrollbar>
          </div>
        </div>
        {/* <span
          className={this.handleCaretClassName}
          style={this.styleCaretPosition}
        /> */}
      </>
    )
  }

  // private get handleCaretClassName() {
  //   return 'flux-functions-toolbar--tooltip-caret'
  // }

  private get handleToolTipClassName() {
    return 'flux-functions-toolbar--tooltip'
  }

  // private get styleCaretPosition(): CSSProperties {
  //   const {
  //     tipPosition: {top, left},
  //   } = this.props
  //   return {
  //     top: `${Math.min(top, window.innerHeight)}px`,
  //     left: `${left + 4}px`,
  //   }
  // }

  private get stylePosition(): CSSProperties {
    const {
      tipPosition: {top, right},
    } = this.props
    const {bottomPosition} = this.state
    console.log('DataPopup stylePosition', this.props.tipPosition)
    const position = {
      top: '0px',
      left: `${0}px`,
      // left: `${right - 2}px`,
    }

    console.log({position})
    return position
  }

  private handleDismiss = (e: MouseEvent<HTMLElement>) => {
    const {onDismiss} = this.props

    e.preventDefault()
    e.stopPropagation()
    onDismiss()
  }
}

export default DataPopup
