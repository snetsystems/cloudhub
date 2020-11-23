// Libraries
import React, {PureComponent, CSSProperties, createRef} from 'react'
import chroma from 'chroma-js'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  onDismiss?: () => void
  tipPosition: {top: number; right: number; left: number}
  tooltipNode: {name: string; cpu: number; memory: number}
  statusColor: chroma.Scale<chroma.Color>
}

interface State {
  topPosition: number | null
  bottomPosition: number | null
  leftPosition: number | null
  rightPosition: number | null
}

@ErrorHandling
class KubernetesTooltip extends PureComponent<Props, State> {
  private tooltipRef = createRef<HTMLDivElement>()
  private tableSize = {
    header: '40%',
    body: '60%',
  }

  private gutter: number = 2

  public constructor(props: Props) {
    super(props)
    this.state = {
      topPosition: null,
      bottomPosition: null,
      leftPosition: null,
      rightPosition: null,
    }
  }

  public componentDidMount() {
    this.calcPosition()
  }

  public componentDidUpdate() {
    this.calcPosition()
  }

  private calcPosition = () => {
    const {
      tipPosition: {left: targetLeft, right: targetRight},
    } = this.props

    const {
      bottom,
      height,
      width,
    } = this.tooltipRef.current.getBoundingClientRect()

    if (bottom > window.innerHeight) {
      this.setState({bottomPosition: height / 2})
    }

    if (targetRight + width + this.gutter > window.innerWidth) {
      this.setState({
        rightPosition: window.innerWidth - targetLeft + this.gutter,
      })
    }
  }

  public render() {
    const {tooltipNode, statusColor} = this.props
    const {name, cpu, memory} = tooltipNode
    return (
      <div
        style={this.stylePosition}
        className={this.handleToolTipClassName}
        ref={this.tooltipRef}
      >
        <div className="kubernetes-toolbar--tooltip-contents">
          <div className={'hosts-table--tbody'}>
            <div className={'hosts-table--tr'}>
              <div className={'hosts-table--td align--start'}>{name}</div>
            </div>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th align--start'}
                style={{width: this.tableSize.header}}
              >
                CPU
              </div>
              <div
                className={'hosts-table--td align--start'}
                style={{width: this.tableSize.body}}
              >
                <div className={'UsageIndacator-container'}>
                  <div className={'UsageIndacator-value'}>{cpu} %</div>
                  <div
                    className={'UsageIndacator'}
                    style={{
                      background: `${statusColor(cpu / 100)}`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th align--start'}
                style={{width: this.tableSize.header}}
              >
                Memory
              </div>
              <div
                className={'hosts-table--td align--start'}
                style={{width: this.tableSize.body}}
              >
                <div className={'UsageIndacator-container'}>
                  <div className={'UsageIndacator-value'}>{memory} %</div>
                  <div
                    className={'UsageIndacator'}
                    style={{
                      background: `${statusColor(memory / 100)}`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  private get handleToolTipClassName() {
    return 'kubernetes-toolbar--tooltip'
  }

  private get stylePosition(): CSSProperties {
    const {
      tipPosition: {top, right},
    } = this.props
    const {bottomPosition, rightPosition} = this.state

    let position = {
      bottom: `${bottomPosition || window.innerHeight - top - 15}px`,
      left: null,
      right: null,
    }
    if (rightPosition) {
      position = {
        ...position,
        right: `${rightPosition}px`,
      }
    } else {
      position = {
        ...position,
        left: `${right + this.gutter}px`,
      }
    }
    return position
  }
}

export default KubernetesTooltip
