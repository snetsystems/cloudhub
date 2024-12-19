// Libraries
import React, {PureComponent} from 'react'
import {Link} from 'react-router'
import classnames from 'classnames'
import moment from 'moment'

// Constants
import {ALERTS_TABLE} from 'src/alerts/constants/tableSizing'

// Types
import {TimeZones} from 'src/types'

interface Props {
  sourceID: string
  name: string | null
  level: string | null
  time: string | null
  host: string | null
  value: string | null
  timeZone: TimeZones
  triggerType?: string
}

const {colName, colLevel, colTime, colHost, colValue} = ALERTS_TABLE

class AlertsTableRow extends PureComponent<Props> {
  public render() {
    return (
      <>
        {this.nameCell}
        {this.levelCell}
        {this.timeCell}
        {this.hostCell}
        {this.valueCell}
      </>
    )
  }
  private get nameCell(): JSX.Element {
    const {name} = this.props

    return (
      <div
        className="alert-history-table--td"
        style={{width: colName}}
        data-test="nameCell"
      >
        {name === null ? <span>{'–'}</span> : <span>{name}</span>}
      </div>
    )
  }

  private get levelCell(): JSX.Element {
    const {level} = this.props

    return (
      <div
        className={`alert-history-table--td alert-level-${
          level === null ? 'null' : level.toLowerCase()
        }`}
        style={{width: colLevel}}
        data-test="levelCell"
      >
        {level === null ? (
          <span>{'–'}</span>
        ) : (
          <span
            className={classnames(
              'table-dot',
              {'dot-critical': level === 'CRITICAL'},
              {'dot-warning': level === 'WARNING'},
              {'dot-success': level === 'OK'}
            )}
          />
        )}
      </div>
    )
  }

  private get timeCell(): JSX.Element {
    return (
      <div
        className="alert-history-table--td"
        style={{width: colTime}}
        data-test="timeCell"
      >
        <span>{this.formattedTime}</span>
      </div>
    )
  }

  private get formattedTime(): string {
    const {time, timeZone} = this.props

    if (time === null) {
      return '–'
    }

    if (timeZone === TimeZones.UTC) {
      return new Date(Number(time)).toISOString()
    }

    return moment(Number(time)).format('YYYY-MM-DDTHH:mm:ss.SSS')
  }

  private get hostCell(): JSX.Element {
    const {sourceID, host, triggerType} = this.props

    return (
      <div
        className="alert-history-table--td alert-history-table--host"
        style={{width: colHost}}
        data-test="hostCell"
      >
        {host === null ? (
          <span>{'–'}</span>
        ) : (
          <Link
            onClick={e => e.stopPropagation()}
            to={`/sources/${sourceID}/infrastructure/details/${host}${
              !!triggerType ? `?trigger=${triggerType}&app=snmp_nx_all` : ''
            }`}
            title={host}
          >
            {host}
          </Link>
          // <span className="alert-history-link">{host}</span>
        )}
      </div>
    )
  }

  private get valueCell(): JSX.Element {
    const {value} = this.props

    return (
      <div
        className="alert-history-table--td"
        style={{width: colValue}}
        data-test="valueCell"
      >
        {value === null ? <span>{'–'}</span> : <span>{value}</span>}
      </div>
    )
  }
}

export default AlertsTableRow
