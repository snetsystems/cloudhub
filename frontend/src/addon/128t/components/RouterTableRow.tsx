import React, {PureComponent} from 'react'
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants'
import {Router, TopSource, TopSession} from 'src/addon/128t/types'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'
import {transBps} from 'src/shared/utils/units'

interface Props {
  router: Router
  focusedAssetId: string
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
}

class RouterTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public focusedClasses = (): string => {
    const {assetId} = this.props.router
    const {focusedAssetId} = this.props
    if (assetId === focusedAssetId) return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }

  private TableItem = ({width, title, className}) => {
    return (
      <div className={`hosts-table--td ${className}`} style={{width: width}}>
        {title ? title : '-'}
      </div>
    )
  }

  private unitIndicator = (value: string | number): JSX.Element => {
    const divider = String(value).split(' ')
    return (
      <>
        {divider[0]}
        <span
          style={{
            width: '50px',
          }}
        >
          <span
            style={{
              padding: '1px 5px',
              borderRadius: '5px',
              background: '#313131',
              textAlign: 'left',
              marginLeft: '5px',
              fontSize: '10px',
              border: '1px solid #a1a1a1',
            }}
          >
            {divider[1]}
          </span>
        </span>
      </>
    )
  }

  render() {
    const {
      assetId,
      locationCoordinates,
      managementConnected,
      bandwidth_avg,
      session_arrivals,
      enabled,
      role,
      startTime,
      softwareVersion,
      memoryUsage,
      cpuUsage,
      diskUsage,
      topSources,
      topSessions,
    } = this.props.router

    const {onClickTableRow} = this.props

    const {
      ASSETID,
      LOCATIONCOORDINATES,
      MANAGEMENTCONNECTED,
      BANDWIDTH_AVG,
      SESSION_CNT_AVG,
      ENABLED,
      ROLE,
      STARTTIME,
      SOFTWAREVERSION,
      MEMORYUSAGE,
      CPUUSAGE,
      DISKUSAGE,
    } = ROUTER_TABLE_SIZING

    return (
      <div
        className={this.focusedClasses()}
        onClick={onClickTableRow(topSources, topSessions, assetId)}
        style={{borderBottom: '1px solid #353535'}}
      >
        <this.TableItem title={assetId} width={ASSETID} className={''} />
        <this.TableItem title={role} width={ROLE} className={''} />
        <this.TableItem
          title={(() => {
            return enabled ? (
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  background: '#4ed8a0',
                  borderRadius: '100%',
                }}
              ></span>
            ) : (
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  background: '#e85b1c',
                  borderRadius: '100%',
                }}
              ></span>
            )
          })()}
          width={ENABLED}
          className={'align--start'}
        />

        <this.TableItem
          title={locationCoordinates}
          width={LOCATIONCOORDINATES}
          className={''}
        />
        <this.TableItem
          title={(() => {
            return managementConnected ? (
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  background: '#4ed8a0',
                  borderRadius: '100%',
                }}
              ></span>
            ) : (
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  background: '#e85b1c',
                  borderRadius: '100%',
                }}
              ></span>
            )
          })()}
          width={MANAGEMENTCONNECTED}
          className={'align--start'}
        />

        <this.TableItem title={startTime} width={STARTTIME} className={''} />
        <this.TableItem
          title={softwareVersion}
          width={SOFTWAREVERSION}
          className={'align--end'}
        />
        <this.TableItem
          title={fixedDecimalPercentage(cpuUsage, 2)}
          width={CPUUSAGE}
          className={'align--end'}
        />
        <this.TableItem
          title={fixedDecimalPercentage(memoryUsage, 2)}
          width={MEMORYUSAGE}
          className={'align--end'}
        />
        <this.TableItem
          title={fixedDecimalPercentage(diskUsage, 2)}
          width={DISKUSAGE}
          className={'align--end'}
        />
        <this.TableItem
          title={session_arrivals}
          width={SESSION_CNT_AVG}
          className={'align--end'}
        />
        <this.TableItem
          title={this.unitIndicator(transBps(bandwidth_avg * 8, 2))}
          width={BANDWIDTH_AVG}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default RouterTableRow
