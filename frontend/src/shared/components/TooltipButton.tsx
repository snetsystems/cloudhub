import React, {PureComponent, MouseEvent} from 'react'
import classnames from 'classnames'
import {ClickOutside} from 'src/shared/components/ClickOutside'
import ReactObserver from 'react-resize-observer'
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  text?: string
  title?: string
  type?: string
  size?: string
  square?: boolean
  icon?: string
  disabled?: boolean
  customClass?: string
  isEventStopPropagation?: boolean
  isButtonLeaveHide?: boolean
  isHideText?: boolean
}

interface State {
  expanded: boolean
}

@ErrorHandling
class TooltipButton extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    type: 'btn-default',
    size: 'btn-sm',
    square: false,
  }

  private buttonDiv: HTMLDivElement
  private tooltipWrap: HTMLDivElement
  private tooltipCaret: HTMLDivElement

  constructor(props: Props) {
    super(props)

    this.state = {
      expanded: false,
    }
  }

  public componentDidMount() {
    this.props.isButtonLeaveHide
      ? (this.buttonDiv.onmouseleave = () => {
          this.setState({expanded: false})
        })
      : null
  }

  public render() {
    const {text, title, isHideText, children} = this.props

    return (
      <ClickOutside onClickOutside={this.handleClickOutside}>
        <div
          className={this.className}
          onClick={(e: MouseEvent) => {
            this.handleButtonClick(e)
          }}
          ref={r => (this.buttonDiv = r)}
          title={title}
        >
          <ReactObserver
            onPosition={() => {
              this.setState({expanded: false})
            }}
          />
          <span
            className={this.classNamesHeader}
            style={{display: 'inline-block'}}
          ></span>
          {!isHideText && text}
          <div
            className={this.tooltipClassName}
            ref={r => (this.tooltipWrap = r)}
          >
            <div className="tooltip-button--inner">{children}</div>
          </div>
          <div
            className={this.classNameCaret}
            ref={r => (this.tooltipCaret = r)}
          />
        </div>
      </ClickOutside>
    )
  }

  private get classNamesHeader(): string {
    const {icon} = this.props
    const headerStyle = classnames('icon', {
      [icon]: icon,
    })

    return headerStyle
  }

  private handleButtonClick = (e: MouseEvent) => {
    if (this.props.isEventStopPropagation) {
      e.stopPropagation()
    }

    if (this.props.disabled) {
      this.setState({expanded: false})
      return
    }

    const pos = this.buttonDiv.getBoundingClientRect()
    const tooltipWrapPos = this.tooltipWrap.getBoundingClientRect()
    const tooltipCaretPos = this.tooltipCaret.getBoundingClientRect()
    const borderWidth = 2

    const bottomPosition =
      pos.left + pos.width / 2 + (tooltipWrapPos.width / 2 + borderWidth)

    let overValue = 0
    if (window.innerWidth < bottomPosition) {
      overValue = bottomPosition - window.innerWidth
    }

    this.tooltipCaret.style.top = `${pos.top +
      pos.height +
      7 -
      tooltipCaretPos.height / 2}px`
    this.tooltipCaret.style.left = `${pos.left +
      pos.width / 2 -
      tooltipCaretPos.width / 2}px`

    this.tooltipWrap.style.top = `${pos.top +
      pos.height +
      tooltipCaretPos.height / 2 -
      borderWidth}px`
    this.tooltipWrap.style.left = `${pos.left + pos.width / 2}px`
    this.tooltipWrap.style.transform = `translateX(calc(-50% - ${overValue}px))`

    this.setState({expanded: true})
  }

  private handleClickOutside = () => {
    this.setState({expanded: false})
  }

  private get className(): string {
    const {type, size, square, disabled, customClass} = this.props
    const {expanded} = this.state

    return classnames(`tooltip-button btn ${type} ${size}`, {
      [customClass]: customClass,
      'btn-square': square,
      active: expanded,
      disabled,
    })
  }

  private get classNameCaret(): string {
    const {expanded} = this.state

    return classnames(`caret`, {
      active: expanded,
    })
  }

  private get tooltipClassName(): string {
    return 'tooltip-button--position bottom'
  }
}

export default TooltipButton
