// libraries
import React, {PureComponent, createRef} from 'react'
import _ from 'lodash'

// types
import {TooltipPosition} from 'src/clouds/types'
import {OpenStackInstanceFlavorDetail} from 'src/clouds/types/openstack'
// decorators
import {ErrorHandling} from 'src/shared/decorators/errors'
import {calculateDataStorage} from 'src/shared/utils/units'

interface Props {
  onDismiss?: () => void
  targetPosition: TooltipPosition
  tooltipNode: Partial<OpenStackInstanceFlavorDetail>
}

interface State {
  top: number | null
  bottom: number | null
  left: number | null
  right: number | null
}

@ErrorHandling
class OpenStackTooltip extends PureComponent<Props, State> {
  private tooltipRef = createRef<HTMLDivElement>()
  private tableSize = {
    header: '55%',
    body: '45%',
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
    const {tooltipNode} = this.props
    const {top, bottom, left, right} = this.state
    const {id, vcpus, ram, size, flavor} = tooltipNode

    return (
      <div
        style={{top, bottom, left, right}}
        className={this.handleToolTipClassName}
        ref={this.tooltipRef}
      >
        <div className="openstack-toolbar--tooltip-contents">
          <div
            style={{padding: '5px', backgroundColor: '#292933'}}
            className={'hosts-table--thead'}
          >
            Flavor Details: {flavor}
          </div>
          <div className={'hosts-table--tbody'}>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--td align--start'}
                style={{width: this.tableSize.header}}
              >
                ID
              </div>
              <div
                className={'hosts-table--td align--start'}
                style={{width: this.tableSize.body}}
              >
                <div className={'UsageIndacator-container'}>
                  <div className={'UsageIndacator-value'}>{id} </div>
                </div>
              </div>
            </div>

            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th align--start'}
                style={{width: this.tableSize.header}}
              >
                VCPUs
              </div>
              <div
                className={'hosts-table--td align--start'}
                style={{width: this.tableSize.body}}
              >
                <div className={'UsageIndacator-container'}>
                  <div className={'UsageIndacator-value'}>{vcpus} </div>
                </div>
              </div>
            </div>

            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th align--start'}
                style={{width: this.tableSize.header}}
              >
                RAM
              </div>
              <div
                className={'hosts-table--td align--start'}
                style={{width: this.tableSize.body}}
              >
                <div className={'UsageIndacator-container'}>
                  <div
                    className={'UsageIndacator-value'}
                  >{`${calculateDataStorage(ram, 'MB', 0)}`}</div>
                </div>
              </div>
            </div>

            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th align--start'}
                style={{width: this.tableSize.header}}
              >
                Size
              </div>
              <div
                className={'hosts-table--td align--start'}
                style={{width: this.tableSize.body}}
              >
                <div className={'UsageIndacator-container'}>
                  <div
                    className={'UsageIndacator-value'}
                  >{`${calculateDataStorage(size, 'GB', 0)}`}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  private get handleToolTipClassName() {
    return 'openstack-toolbar--tooltip'
  }
}

export default OpenStackTooltip
