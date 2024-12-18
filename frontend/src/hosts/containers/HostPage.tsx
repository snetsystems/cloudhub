import React, {PureComponent} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import classnames from 'classnames'

import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import DashboardHeader from 'src/dashboards/components/DashboardHeader'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import ManualRefresh from 'src/shared/components/ManualRefresh'
import {generateForHosts} from 'src/utils/tempVars'

import {timeRanges} from 'src/shared/data/timeRanges'
import {
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
  loadHostsLinks,
} from 'src/hosts/apis'
import {EMPTY_LINKS} from 'src/dashboards/constants/dashboardHeader'
import {notIncludeApps} from 'src/hosts/constants/apps'

import {
  setAutoRefresh,
  delayEnablePresentationMode,
  setTimeZone,
} from 'src/shared/actions/app'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getCells} from 'src/hosts/utils/getCells'

import {Source, Layout, TimeRange, TimeZones} from 'src/types'
import {Location} from 'history'
import {DashboardSwitcherLinks} from 'src/types/dashboards'
import {CloudAutoRefresh} from 'src/clouds/types/type'

interface Props {
  source: Source
  params: {
    hostID: string
  }
  location: Location
  inPresentationMode: boolean
  autoRefresh: number
  manualRefresh: number
  timeZone: TimeZones
  onSetTimeZone: typeof setTimeZone
  onManualRefresh: () => void
  handleChooseTimeRange: typeof setAutoRefresh
  handleClickPresentationButton: typeof delayEnablePresentationMode
  cloudAutoRefresh: CloudAutoRefresh
}

interface State {
  layouts: Layout[]
  hostLinks: DashboardSwitcherLinks
  timeRange: TimeRange
  isAgentHost: boolean
}

class HostPage extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      layouts: [],
      hostLinks: EMPTY_LINKS,
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      isAgentHost: false,
    }
    this.handleChooseAutoRefresh = this.handleChooseAutoRefresh.bind(this)
  }

  public async componentDidMount() {
    const {location, autoRefresh} = this.props
    const isAgentHost = location?.query?.trigger === 'anomaly_predict'

    this.setState({isAgentHost: isAgentHost})

    const {
      data: {layouts},
    } = await getLayouts()

    const filteredNotIncludeApps = isAgentHost
      ? notIncludeApps.filter(app => app !== 'snmp_nx_ifdesc')
      : notIncludeApps

    const filterLayouts = _.filter(
      layouts,
      m => !_.includes(filteredNotIncludeApps, m.app)
    )

    // fetching layouts and mappings can be done at the same time
    const {host, measurements} = await this.fetchHostsAndMeasurements(
      filterLayouts
    )

    const focusedApp = location.query.app

    const filteredLayouts = filterLayouts
      .filter(filterLayouts => {
        return focusedApp
          ? filterLayouts.app === focusedApp
          : host.apps &&
              host.apps.includes(filterLayouts.app) &&
              measurements.includes(filterLayouts.measurement)
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    const hostLinks = await this.getHostLinks()

    this.setState({layouts: filteredLayouts, hostLinks}) // eslint-disable-line react/no-did-mount-set-state

    GlobalAutoRefresher.poll(autoRefresh)
  }

  public componentDidUpdate(prevProps) {
    const {autoRefresh} = this.props

    if (prevProps.autoRefresh !== autoRefresh) {
      GlobalAutoRefresher.poll(autoRefresh)
    }
  }

  public componentWillUnmount() {
    GlobalAutoRefresher.stopPolling()
  }

  public handleChooseAutoRefresh(option) {
    const {handleChooseTimeRange} = this.props
    const {milliseconds} = option
    handleChooseTimeRange(milliseconds)
  }

  public render() {
    const {
      autoRefresh,
      manualRefresh,
      onManualRefresh,
      params: {hostID},
      inPresentationMode,
      handleClickPresentationButton,
      source,
      timeZone,
      onSetTimeZone,
    } = this.props
    const {timeRange, hostLinks, layouts} = this.state

    const layoutCells = getCells(layouts, source)
    const tempVars = generateForHosts(source)

    return (
      <div className="page">
        <DashboardHeader
          timeZone={timeZone}
          onSetTimeZone={onSetTimeZone}
          timeRange={timeRange}
          activeDashboard={hostID}
          autoRefresh={autoRefresh}
          isHidden={inPresentationMode}
          onManualRefresh={onManualRefresh}
          handleChooseAutoRefresh={this.handleChooseAutoRefresh}
          handleChooseTimeRange={this.handleChooseTimeRange}
          handleClickPresentationButton={handleClickPresentationButton}
          dashboardLinks={hostLinks}
        />
        <FancyScrollbar
          className={classnames({
            'page-contents': true,
            'presentation-mode': inPresentationMode,
          })}
        >
          <div className="container-fluid full-width dashboard">
            <LayoutRenderer
              source={source}
              sources={[source]}
              isStatusPage={false}
              isStaticPage={true}
              isEditable={false}
              cells={layoutCells}
              templates={tempVars}
              timeRange={timeRange}
              manualRefresh={manualRefresh}
              host={hostID}
            />
          </div>
        </FancyScrollbar>
      </div>
    )
  }

  private handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      this.setState({timeRange: {lower, upper}})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      this.setState({timeRange})
    }
  }

  private async fetchHostsAndMeasurements(layouts: Layout[]) {
    const {source, params} = this.props
    const tempVars = generateForHosts(source)

    const fetchMeasurements = getMeasurementsForHost(
      source,
      params.hostID,
      this.state.isAgentHost ? 'snmp_nx' : null
    )

    const fetchHosts = getAppsForHost(
      source.links.proxy,
      params.hostID,
      layouts,
      source.telegraf,
      tempVars,
      this.state.isAgentHost ? 'snmp_nx' : null
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  private getHostLinks = async () => {
    const {
      source,
      params: {hostID},
    } = this.props

    const activeHost = {name: hostID}
    const links = await loadHostsLinks(source, activeHost)

    return links
  }
}

const mstp = ({
  app: {
    ephemeral: {inPresentationMode},
    persisted: {autoRefresh, cloudAutoRefresh, timeZone},
  },
}) => ({
  inPresentationMode,
  cloudAutoRefresh,
  autoRefresh,
  timeZone,
})

const mdtp = {
  handleChooseTimeRange: setAutoRefresh,
  handleClickPresentationButton: delayEnablePresentationMode,
  onSetTimeZone: setTimeZone,
}

export default connect(mstp, mdtp)(ManualRefresh(ErrorHandling(HostPage)))
