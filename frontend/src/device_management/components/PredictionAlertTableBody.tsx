// Components
import React, {PureComponent} from 'react'

// Libraries
import _ from 'lodash'
import uuid from 'uuid'
import {Link} from 'react-router'

// Components
import AlertsTableRow from 'src/alerts/components/AlertsTableRow'
import SearchBar from 'src/alerts/components/SearchBar'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Constants
import {ALERTS_TABLE} from 'src/alerts/constants/tableSizing'

// Types
import {Alert} from 'src/types/alerts'
import {AnomalyFactor, Source, TimeZones} from 'src/types'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Redux
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {setSelectedAnomaly} from 'src/device_management/actions'

enum Direction {
  ASC = 'asc',
  DESC = 'desc',
  NONE = 'none',
}

interface OwnProps {
  alerts: Alert[]
  source: Source
  shouldNotBeFilterable: boolean
  limit: number
  isAlertsMaxedOut: boolean
  alertsCount: number
  onGetMoreAlerts: () => void
  setSelectedAnomaly?: (anomalyFactor: AnomalyFactor) => void
  selectedAnomaly?: AnomalyFactor
  filteredHexbinHost?: string
}

interface StateProps {
  timeZone?: TimeZones
}

interface State {
  searchTerm: string
  filteredAlerts: Alert[]
  sortDirection: Direction
  sortKey: string
}

type Props = OwnProps & StateProps

@ErrorHandling
class PredictionAlertTableBody extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      searchTerm: '',
      filteredAlerts: this.props.alerts,
      sortDirection: Direction.NONE,
      sortKey: '',
    }
  }

  public UNSAFE_componentWillReceiveProps(newProps) {
    this.filterAlerts(this.state.searchTerm, newProps.alerts)
  }

  public componentWillUnmount(): void {
    this.props.setSelectedAnomaly({
      host: '',
      time: '',
    })
  }

  public render() {
    const {
      shouldNotBeFilterable,
      limit,
      onGetMoreAlerts,
      isAlertsMaxedOut,
      alertsCount,
    } = this.props

    return shouldNotBeFilterable ? (
      <div className="alerts-widget">
        <div className="panel-heading">
          <h2 className="panel-title">
            {this.state.filteredAlerts.length} Alerts
          </h2>
          {this.props.alerts.length ? (
            <SearchBar onSearch={this.filterAlerts} />
          ) : null}
        </div>
        {this.renderTable()}
        {limit && alertsCount ? (
          <button
            className="btn btn-sm btn-default btn-block"
            onClick={onGetMoreAlerts}
            disabled={isAlertsMaxedOut}
            style={{marginBottom: '20px'}}
          >
            {isAlertsMaxedOut
              ? `All ${this.state.filteredAlerts.length} Alerts displayed`
              : 'Load next 30 Alerts'}
          </button>
        ) : null}
      </div>
    ) : (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">{this.props.alerts.length} Alerts</h2>
          {this.props.alerts.length ? (
            <SearchBar onSearch={this.filterAlerts} />
          ) : null}
        </div>
        <div className="panel-body">{this.renderTable()}</div>
      </div>
    )
  }

  private filterAlerts = (searchTerm: string, newAlerts?: Alert[]): void => {
    const alerts = newAlerts || this.props.alerts
    const filterText = searchTerm.toLowerCase()
    const filteredAlerts = alerts.filter(({name, host, level, value}) => {
      return (
        (name && name.toLowerCase().includes(filterText)) ||
        (host && host.toLowerCase().includes(filterText)) ||
        (level && level.toLowerCase().includes(filterText)) ||
        (value && value.toLowerCase().includes(filterText))
      )
    })
    this.setState({searchTerm, filteredAlerts})
  }

  private changeSort = (key: string): (() => void) => (): void => {
    // if we're using the key, reverse order; otherwise, set it with ascending
    if (this.state.sortKey === key) {
      const reverseDirection: Direction =
        this.state.sortDirection === Direction.ASC
          ? Direction.DESC
          : Direction.ASC
      this.setState({sortDirection: reverseDirection})
    } else {
      this.setState({sortKey: key, sortDirection: Direction.ASC})
    }
  }

  private sortableClasses = (key: string): string => {
    if (this.state.sortKey === key) {
      if (this.state.sortDirection === Direction.ASC) {
        return 'alert-history-table--th sortable-header sorting-ascending'
      }
      return 'alert-history-table--th sortable-header sorting-descending'
    }
    return 'alert-history-table--th sortable-header'
  }

  private sort = (
    alerts: Alert[],
    key: string,
    direction: Direction
  ): Alert[] => {
    switch (direction) {
      case Direction.ASC:
        return _.sortBy<Alert>(alerts, e => e[key])
      case Direction.DESC:
        return _.sortBy<Alert>(alerts, e => e[key]).reverse()
      default:
        return alerts
    }
  }

  private renderTable(): JSX.Element {
    const {
      source: {id},
      timeZone,
      selectedAnomaly,
    } = this.props
    const alerts = this.sort(
      this.state.filteredAlerts,
      this.state.sortKey,
      this.state.sortDirection
    )

    const {colName, colLevel, colTime, colHost, colValue} = ALERTS_TABLE
    return this.props.alerts.length ? (
      <div className="alert-history-table">
        <div className="alert-history-table--thead">
          <div
            onClick={this.changeSort('name')}
            className={this.sortableClasses('name')}
            style={{width: colName}}
          >
            Name <span className="icon caret-up" />
          </div>
          <div
            onClick={this.changeSort('level')}
            className={this.sortableClasses('level')}
            style={{width: colLevel}}
          >
            Level <span className="icon caret-up" />
          </div>
          <div
            onClick={this.changeSort('time')}
            className={this.sortableClasses('time')}
            style={{width: colTime}}
          >
            Time ({timeZone})<span className="icon caret-up" />
          </div>
          <div
            onClick={this.changeSort('host')}
            className={this.sortableClasses('host')}
            style={{width: colHost}}
          >
            Source <span className="icon caret-up" />
          </div>
          <div
            onClick={this.changeSort('value')}
            className={this.sortableClasses('value')}
            style={{width: colValue}}
          >
            Value <span className="icon caret-up" />
          </div>
        </div>
        <FancyScrollbar>
          {alerts.map(alert => (
            <div
              onClick={() => {
                this.onClickHandler(alert.time, alert.host)
              }}
              className={`alert-history-table--tr ${
                selectedAnomaly.time === alert.time &&
                selectedAnomaly.host === alert.host
                  ? 'selected'
                  : ''
              } pointer`}
              key={uuid.v4()}
            >
              <AlertsTableRow sourceID={id} {...alert} timeZone={timeZone} />
            </div>
          ))}
        </FancyScrollbar>
      </div>
    ) : (
      this.renderTableEmpty()
    )
  }

  private renderTableEmpty(): JSX.Element {
    const {
      source: {id},
      shouldNotBeFilterable,
    } = this.props

    return shouldNotBeFilterable ? (
      <div className="graph-empty">
        <h4 className="no-user-select">No Result</h4>
      </div>
    ) : (
      <div className="generic-empty-state">
        <h4 className="no-user-select">No Result</h4>
        <br />
        <h6 className="no-user-select">
          Try changing the Time Range or
          <Link
            style={{marginLeft: '10px'}}
            to={`/sources/${id}/alert-rules/new`}
            className="btn btn-primary btn-sm"
          >
            Create an Alert Rule
          </Link>
        </h6>
      </div>
    )
  }

  private onClickHandler = (time: string, host: string) => {
    const {selectedAnomaly, setSelectedAnomaly} = this.props

    if (selectedAnomaly.host === host && selectedAnomaly.time === time) {
      setSelectedAnomaly({
        host: '',
        time: '',
      })
    } else {
      setSelectedAnomaly({
        host: host,
        time: time,
      })
    }
  }
}

const mstp = ({app, predictionDashboard}) => ({
  timeZone: app.persisted.timeZone,
  selectedAnomaly: predictionDashboard.selectedAnomaly,
  filteredHexbinHost: predictionDashboard.filteredHexbinHost,
})

const mdtp = dispatch => ({
  setSelectedAnomaly: bindActionCreators(setSelectedAnomaly, dispatch),
})

export default connect(mstp, mdtp, null)(PredictionAlertTableBody)
