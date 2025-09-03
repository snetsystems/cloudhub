// Libraries
import React, {PureComponent, createRef} from 'react'
import chroma from 'chroma-js'
import _ from 'lodash'

// Types
import {TooltipNode, TooltipPosition} from 'src/clouds/types'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  onDismiss?: () => void
  targetPosition: TooltipPosition
  tooltipNode: TooltipNode
  statusColor: chroma.Scale<chroma.Color>
}

interface State {
  top: number | null
  bottom: number | null
  left: number | null
  right: number | null
}

@ErrorHandling
class KubernetesTooltip extends PureComponent<Props, State> {
  private tooltipRef = createRef<HTMLDivElement>()
  private tableSize = {
    header: '35%',
    body: '65%',
  }

  public constructor(props: Props) {
    super(props)
    this.state = {
      top: null,
      bottom: null,
      left: null,
      right: null,
    }
  }

  public componentDidMount() {
    this.calcPosition()
  }

  private calcPosition = () => {
    const {targetPosition} = this.props
    const {top, width, right} = targetPosition
    const {width: tipWidth} = this.tooltipRef.current.getBoundingClientRect()

    let position = {
      bottom: window.innerHeight - top,
      left: right - width / 2 - tipWidth / 2,
    }

    this.setState({...position})
  }

  public render() {
    const {tooltipNode, statusColor} = this.props
    const {top, bottom, left, right} = this.state
    const {name, cpu, memory, iops, bandwidth, latency} = tooltipNode

    const iopsPercent = _.isNumber(iops)
      ? Math.min((iops / 100000) * 100, 100)
      : 0
    const bandwidthPercent = _.isNumber(bandwidth)
      ? Math.min((bandwidth / 700000) * 100, 100)
      : 0

    const fmt = (v: number, frac: number) =>
      _.isNumber(v) && Number.isFinite(v)
        ? Number(v).toLocaleString('en-US', {
            minimumFractionDigits: frac,
            maximumFractionDigits: frac,
            useGrouping: true,
          })
        : `0.${'0'.repeat(frac)}`
    const iopsDisplay = fmt(iops as number, 1)
    const bandwidthDisplay = fmt(bandwidth as number, 1)
    const latencyDisplay = fmt(latency as number, 3)

    return (
      <div
        style={{top, bottom, left, right}}
        className={this.handleToolTipClassName}
        ref={this.tooltipRef}
      >
        <div
          className="kubernetes-toolbar--tooltip-contents"
          style={{minWidth: '280px'}}
        >
          <div className={'hosts-table--tbody'}>
            {name ? (
              <div className={'hosts-table--tr'} style={{minHeight: '24px'}}>
                <div className={'hosts-table--td align--start'}>{name}</div>
              </div>
            ) : null}
            {!_.isNaN(cpu) && _.isNumber(cpu) ? (
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
            ) : null}
            {!_.isNaN(memory) && _.isNumber(memory) ? (
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
            ) : null}
            {!_.isNaN(iops) && _.isNumber(iops) ? (
              <div className={'hosts-table--tr'}>
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: this.tableSize.header}}
                >
                  IOPS
                </div>
                <div
                  className={'hosts-table--td align--start'}
                  style={{width: this.tableSize.body}}
                >
                  <div className={'UsageIndacator-container'}>
                    <div className={'UsageIndacator-value'}>
                      {iopsDisplay} io/s
                    </div>
                    <div
                      className={'UsageIndacator'}
                      style={{
                        background: `${statusColor(iopsPercent / 100)}`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : null}
            {!_.isNaN(bandwidth) && _.isNumber(bandwidth) ? (
              <div className={'hosts-table--tr'}>
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: this.tableSize.header}}
                >
                  Bandwidth
                </div>
                <div
                  className={'hosts-table--td align--start'}
                  style={{width: this.tableSize.body}}
                >
                  <div className={'UsageIndacator-container'}>
                    <div className={'UsageIndacator-value'}>
                      {bandwidthDisplay} kB/s
                    </div>
                    <div
                      className={'UsageIndacator'}
                      style={{
                        background: `${statusColor(bandwidthPercent / 100)}`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : null}
            {!_.isNaN(latency) && _.isNumber(latency) ? (
              <div className={'hosts-table--tr'}>
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: this.tableSize.header}}
                >
                  Latency
                </div>
                <div
                  className={'hosts-table--td align--start'}
                  style={{width: this.tableSize.body}}
                >
                  <div className={'UsageIndacator-container'}>
                    <div className={'UsageIndacator-value'}>
                      {latencyDisplay} ms
                    </div>
                    <div
                      className={'UsageIndacator'}
                      style={{
                        background: `${statusColor(
                          Math.min(latency / 100, 1)
                        )}`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  private get handleToolTipClassName() {
    return 'kubernetes-toolbar--tooltip'
  }
}

export default KubernetesTooltip
