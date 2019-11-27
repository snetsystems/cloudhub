// Libraries
import React, { PureComponent, MouseEvent, CSSProperties, createRef } from 'react'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Decorators
import { ErrorHandling } from 'src/shared/decorators/errors'

interface Props {
  description: string
  onDismiss: () => void
  tipPosition: { top: number, left: number }
}

interface State {
  bottomPosition: number
  currentWidth: number
}

const MAX_HEIGHT = 400

@ErrorHandling
class AgentTooltip extends PureComponent<Props, State> {
  private tooltipRef = createRef<HTMLDivElement>()

  public constructor(props: Props) {
    super(props)
    this.state = { bottomPosition: null, currentWidth: null }
  }

  public componentDidMount() {
    const {
      bottom,
      height,
      width,
    } = this.tooltipRef.current.getBoundingClientRect()

    if (bottom > window.innerHeight) {
      this.setState({ bottomPosition: height / 2, currentWidth: width })
    } else {
      this.setState({ currentWidth: width })
    }
  }

  public render() {
    const { description } = this.props

    return (
      <>
        <div
          style={this.stylePosition}
          className="flux-functions-toolbar--tooltip"
          ref={this.tooltipRef}
        >
          <button
            className="flux-functions-toolbar--tooltip-dismiss"
            onClick={this.handleDismiss}
          />{' '}
          <div
            className="flux-functions-toolbar--tooltip-contents"
            style={{
              width: 400 + 'px',
            }}
          >
            <FancyScrollbar
              autoHeight={true}
              maxHeight={MAX_HEIGHT}
              autoHide={false}
            >
              <article className="flux-functions-toolbar--description">
                <pre
                  style={{
                    color: '#fff',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {description}
                </pre>
              </article>
            </FancyScrollbar>
          </div>
        </div>
        <span
          className="flux-functions-toolbar--tooltip-caret"
          style={this.styleCaretPosition}
        />
      </>
    )
  }

  private get styleCaretPosition(): CSSProperties {
    const {
      tipPosition: { top, left },
    } = this.props

    return {
      top: `${Math.min(top, window.innerHeight)}px`,
      left: `${left - 10}px`,
    }
  }

  private get stylePosition(): CSSProperties {
    const {
      tipPosition: { top, left },
    } = this.props
    const { bottomPosition, currentWidth } = this.state

    return {
      bottom: `${bottomPosition || window.innerHeight - top - 15}px`,
      left: `${left - currentWidth - 10}px`,
    }
  }

  private handleDismiss = (e: MouseEvent<HTMLElement>) => {
    const { onDismiss } = this.props

    e.preventDefault()
    e.stopPropagation()
    onDismiss()
  }
}

export default AgentTooltip
