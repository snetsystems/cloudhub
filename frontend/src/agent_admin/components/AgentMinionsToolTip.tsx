// libraries
import React, {PureComponent, createRef, Fragment} from 'react'
import _ from 'lodash'

// types
import {TooltipPosition} from 'src/clouds/types'

// decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  onDismiss?: () => void
  targetPosition: TooltipPosition
  tooltipNode: string[]
}

interface State {
  top: number | null
  bottom: number | null
  left: number | null
  right: number | null
}

@ErrorHandling
class AgentMinionsToolTip extends PureComponent<Props, State> {
  private tooltipRef = createRef<HTMLDivElement>()

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
    const {tooltipNode} = this.props
    const {top, bottom, left, right} = this.state

    return (
      <div
        style={{top, bottom, left, right}}
        className={this.handleToolTipClassName}
        ref={this.tooltipRef}
      >
        <div className="agentadmin-toolbar--tooltip-contents">
          <div
            style={{
              padding: '5px',
              backgroundColor: '#f58220',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#eeeff2',
            }}
            className={'hosts-table--thead'}
          >
            IP Address
          </div>
          <div className={'hosts-table--tbody'}>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--td align--start'}
                style={{width: '100%', padding: '2px 5px'}}
              >
                <div
                  className={'UsageIndacator-container'}
                  style={{textAlign: 'left', fontWeight: 500, color: '#eeeff2'}}
                >
                  <div className={'UsageIndacator-value'}>
                    {tooltipNode.map(ip => (
                      <Fragment key={ip}>
                        {ip}
                        <br />
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  private get handleToolTipClassName() {
    return 'agentadmin-toolbar--tooltip'
  }
}

export default AgentMinionsToolTip
