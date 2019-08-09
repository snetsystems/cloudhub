// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import classnames from 'classnames'

// Components
import HostsTable from 'src/hosts/components/HostsTable'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import {Page} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'

// APIs
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHosts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'
import {getEnv} from 'src/shared/apis/env'

// Actions
import {setAutoRefresh} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {getCells} from 'src/hosts/utils/getCells'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Constants
import {
  notifyUnableToGetHosts,
  notifyUnableToGetApps,
} from 'src/shared/copy/notifications'

// Types
import {
  Source,
  Links,
  NotificationAction,
  RemoteDataState,
  Host,
  Layout,
  TimeRange,
} from 'src/types'
import {timeRanges} from 'src/shared/data/timeRanges'

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  onChooseAutoRefresh: () => void
  notify: NotificationAction
}

interface State {
  hostsObject: {[x: string]: Host}
  hostsPageStatus: RemoteDataState
  layouts: Layout[]
  timeRange: TimeRange
}

@ErrorHandling
export class HostsPage extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    manualRefresh: 0,
  }
  public intervalID: number

  constructor(props: Props) {
    super(props)

    this.state = {
      hostsObject: {},
      hostsPageStatus: RemoteDataState.NotStarted,
      layouts: [],
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
    }
  }

  public async componentDidMount() {
    const {notify, autoRefresh} = this.props

    this.setState({hostsPageStatus: RemoteDataState.Loading})

    const layoutResults = await getLayouts()
    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetApps())
      this.setState({
        hostsPageStatus: RemoteDataState.Error,
        layouts,
      })
      return
    }

    // For rendering whole hosts list
    await this.fetchHostsData(layouts)

    // For rendering the charts with the focused single host.
    const hostID = this.getFirstHost(this.state.hostsObject)
    const {host, measurements} = await this.fetchHostsAndMeasurements(
      layouts,
      hostID
    )

    const focusedApp = 'system'

    const filteredLayouts = layouts.filter(layout => {
      return focusedApp
        ? layout.app === focusedApp &&
            host.apps &&
            host.apps.includes(layout.app) &&
            measurements.includes(layout.measurement)
        : host.apps &&
            host.apps.includes(layout.app) &&
            measurements.includes(layout.measurement)
    })

    if (autoRefresh) {
      this.intervalID = window.setInterval(
        () => this.fetchHostsData(layouts),
        autoRefresh
      )
    }
    GlobalAutoRefresher.poll(autoRefresh)

    this.setState({layouts: filteredLayouts})
  }

  public componentDidUpdate(prevProps) {
    const {autoRefresh} = this.props

    if (prevProps.autoRefresh !== autoRefresh) {
      GlobalAutoRefresher.poll(autoRefresh)
    }
  }

  public componentWillReceiveProps(nextProps: Props) {
    const {layouts} = this.state
    if (layouts) {
      if (this.props.manualRefresh !== nextProps.manualRefresh) {
        this.fetchHostsData(layouts)
      }

      if (this.props.autoRefresh !== nextProps.autoRefresh) {
        clearInterval(this.intervalID)

        if (nextProps.autoRefresh) {
          this.intervalID = window.setInterval(
            () => this.fetchHostsData(layouts),
            nextProps.autoRefresh
          )
        }
      }
    }
  }

  public componentWillUnmount() {
    clearInterval(this.intervalID)
    this.intervalID = null
    GlobalAutoRefresher.stopPolling()
  }

  public render() {
    const {
      source,
      autoRefresh,
      onChooseAutoRefresh,
      onManualRefresh,
    } = this.props
    const {hostsObject, hostsPageStatus, layouts, timeRange} = this.state

    const layoutCells = getCells(layouts, source)
    const tempVars = generateForHosts(source)

    return (
      <Page className="hosts-list-page">
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Infrastructure" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true}>
            <AutoRefreshDropdown
              selected={autoRefresh}
              onChoose={onChooseAutoRefresh}
              onManualRefresh={onManualRefresh}
            />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents scrollable={true}>
          <HostsTable
            source={source}
            hosts={_.values(hostsObject)}
            hostsPageStatus={hostsPageStatus}
          />
        </Page.Contents>
        <FancyScrollbar
          className={classnames({
            'page-contents': true,
          })}
        >
          <div className="container-fluid full-width dashboard">
            <LayoutRenderer
              source={source}
              sources={[source]}
              isStatusPage={false}
              isEditable={false}
              cells={layoutCells}
              templates={tempVars}
              timeRange={timeRange}
              manualRefresh={this.props.manualRefresh}
              host={this.getFirstHost(hostsObject)}
            />
          </div>
        </FancyScrollbar>
      </Page>
    )
  }

  private async fetchHostsData(layouts: Layout[]): Promise<void> {
    const {source, links, notify} = this.props

    const envVars = await getEnv(links.environment)
    const telegrafSystemInterval = getDeep<string>(
      envVars,
      'telegrafSystemInterval',
      ''
    )
    const hostsError = notifyUnableToGetHosts().message
    const tempVars = generateForHosts(source)

    try {
      const hostsObject = await getCpuAndLoadForHosts(
        source.links.proxy,
        source.telegraf,
        telegrafSystemInterval,
        tempVars
      )
      if (!hostsObject) {
        throw new Error(hostsError)
      }
      const newHosts = await getAppsForHosts(
        source.links.proxy,
        hostsObject,
        layouts,
        source.telegraf
      )

      this.setState({
        hostsObject: newHosts,
        hostsPageStatus: RemoteDataState.Done,
      })
    } catch (error) {
      console.error(error)
      notify(notifyUnableToGetHosts())
      this.setState({
        hostsPageStatus: RemoteDataState.Error,
      })
    }
  }

  private async fetchHostsAndMeasurements(layouts: Layout[], hostID: string) {
    const {source} = this.props

    const fetchMeasurements = getMeasurementsForHost(source, hostID)
    const fetchHosts = getAppsForHost(
      source.links.proxy,
      hostID,
      layouts,
      source.telegraf
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  private getFirstHost = (hostsObject: {[x: string]: Host}): string => {
    const hostsArray = _.values(hostsObject)
    return hostsArray.length > 0 ? hostsArray[0].name : null
  }
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh},
    },
    links,
  } = state
  return {
    links,
    autoRefresh,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp)(ManualRefresh<Props>(HostsPage))
