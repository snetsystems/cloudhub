import React, {PureComponent} from 'react'
import classnames from 'classnames'
import {unitIndicator} from 'src/addon/128t/reusable'
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

  private TableItem = ({
    width,
    title,
    className = '',
  }: {
    width: string
    title: string | number | JSX.Element
    className: string
  }) => {
    return (
      <div className={`hosts-table--td ${className}`} style={{width: width}}>
        {title || title === 0 ? title : '-'}
      </div>
    )
  }

  private responseIndicator = (isEnabled: boolean): JSX.Element => {
    return (
      <span
        className={classnames('status-indicator', {
          'status-indicator--enabled': isEnabled,
        })}
      />
    )
  }

  private get enabledIndicator(): JSX.Element {
    const {enabled} = this.props.router
    return this.responseIndicator(enabled)
  }

  private get connectedIndicator(): JSX.Element {
    const {managementConnected} = this.props.router
    return this.responseIndicator(managementConnected)
  }

  render() {
    const {
      assetId,
      locationCoordinates,
      bandwidth_avg,
      session_arrivals,
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
      >
        <this.TableItem title={assetId} width={ASSETID} className={''} />
        <this.TableItem title={role} width={ROLE} className={''} />
        <this.TableItem
          title={this.enabledIndicator}
          width={ENABLED}
          className={'align--start'}
        />

        <this.TableItem
          title={locationCoordinates}
          width={LOCATIONCOORDINATES}
          className={''}
        />
        <this.TableItem
          title={this.connectedIndicator}
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
          title={unitIndicator(transBps(bandwidth_avg * 8, 2), ' ')}
          width={BANDWIDTH_AVG}
          className={'align--end'}
        />
        <this.TableItem
          title={session_arrivals}
          width={SESSION_CNT_AVG}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default RouterTableRow
