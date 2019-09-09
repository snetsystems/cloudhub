// Libraries
import React, { PureComponent } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import _ from 'lodash'
import { getDeep } from 'src/utils/wrappers'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import { Page } from 'src/reusable_ui'
import { ErrorHandling } from 'src/shared/decorators/errors'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import TreeMenu from 'src/reusable_ui/components/treemenu'
import { Item } from 'src/reusable_ui/components/treemenu/TreeMenu/walk'

// APIs
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHosts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'
import { getEnv } from 'src/shared/apis/env'

// Actions
import { setAutoRefresh } from 'src/shared/actions/app'
import { notify as notifyAction } from 'src/shared/actions/notifications'

// Utils
import { generateForHosts } from 'src/utils/tempVars'
import { getCells } from 'src/hosts/utils/getCells'
import { GlobalAutoRefresher } from 'src/utils/AutoRefresher'

// Constants
import {
  notifyUnableToGetHosts,
  notifyUnableToGetApps,
} from 'src/shared/copy/notifications'
import { HANDLE_VERTICAL } from 'src/shared/constants'

// Types
import {
  Source,
  Links,
  NotificationAction,
  Host,
  Layout,
  TimeRange,
} from 'src/types'
import { timeRanges } from 'src/shared/data/timeRanges'

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  onChooseAutoRefresh: () => void
  notify: NotificationAction
}

interface State {
  hostsObject: { [x: string]: Host }
  appHostData: {}
  layouts: Layout[]
  filteredLayouts: Layout[]
  focusedHost: string
  focusedApp: string
  timeRange: TimeRange
  proportions: number[]
}

@ErrorHandling
export class Applications extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    manualRefresh: 0,
  }

  public intervalID: number

  constructor(props: Props) {
    super(props)

    this.state = {
      hostsObject: {},
      appHostData: {},
      layouts: [],
      filteredLayouts: [],
      focusedHost: '',
      focusedApp: '',
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      proportions: [0.25, 0.75],
    }
  }

  public async componentDidMount() {
    const { notify, autoRefresh } = this.props

    const layoutResults = await getLayouts()
    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetApps())
      this.setState({ layouts })
      return
    }

    // For rendering whole hosts list(setState(hostsObject))
    await this.fetchHostsAppsData(layouts)

    if (autoRefresh) {
      this.intervalID = window.setInterval(
        () => this.fetchHostsAppsData(layouts),
        autoRefresh
      )
    }
    GlobalAutoRefresher.poll(autoRefresh)

    this.setState({ layouts })
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const { autoRefresh } = this.props
    const { layouts, focusedHost, focusedApp } = this.state

    if (layouts) {
      if (
        prevState.focusedHost !== focusedHost ||
        prevState.focusedApp !== focusedApp
      ) {
        this.fetchHostsAppsData(layouts)
        const { filteredLayouts } = await this.getLayoutsforHostApp(
          layouts,
          focusedHost,
          focusedApp
        )
        this.setState({ filteredLayouts })
      }

      if (prevProps.autoRefresh !== autoRefresh) {
        GlobalAutoRefresher.poll(autoRefresh)
      }
    }
  }

  public componentWillUnmount() {
    clearInterval(this.intervalID)
    this.intervalID = null
    GlobalAutoRefresher.stopPolling()
  }

  public render() {
    const { autoRefresh, onChooseAutoRefresh, onManualRefresh } = this.props

    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="Applications" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true}>
            <AutoRefreshDropdown
              selected={autoRefresh}
              onChoose={onChooseAutoRefresh}
              onManualRefresh={onManualRefresh}
            />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <Threesizer
            orientation={HANDLE_VERTICAL}
            divisions={this.threesizerDivisions}
            onResize={this.handleResize}
          />
        </Page.Contents>
      </Page>
    )
  }

  private handleResize = (proportions: number[]) => {
    this.setState({ proportions })
  }

  private get threesizerDivisions() {
    const { source } = this.props
    const {
      appHostData,
      proportions,
      filteredLayouts,
      focusedHost,
      timeRange,
    } = this.state
    const [leftSize, rightSize] = proportions

    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    return [
      {
        name: 'Application Tree',
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [],
        menuOptions: [],
        size: leftSize,
        render: () => (
          <Page.Contents fullWidth={true}>
            <TreeMenu data={appHostData} onClickItem={this.onSelectedHost} />
          </Page.Contents>
        ),
      },
      {
        name: 'Charts',
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [],
        menuOptions: [],
        size: rightSize,
        render: () => (
          <Page.Contents>
            <LayoutRenderer
              source={source}
              sources={[source]}
              isStatusPage={false}
              isStaticPage={true}
              isEditable={false}
              cells={layoutCells}
              templates={tempVars}
              timeRange={timeRange}
              manualRefresh={this.props.manualRefresh}
              host={focusedHost}
            />
          </Page.Contents>
        ),
      },
    ]
  }

  private onSelectedHost = (props: Item) => {
    if (props.level === 2) {
      const apps = props.parent.split('/')
      this.setState({ focusedHost: props.label, focusedApp: apps[1] })
    }
  }

  private fetchHostsAppsData = async (layouts: Layout[]): Promise<void> => {
    const { source, links, notify } = this.props

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

      const appHostData = Object.keys(newHosts).reduce(
        (acc, hostName) => {
          const apps = newHosts[hostName].apps
          apps.reduce((acc, appName) => {
            const key = this.getCategoryKeyforApp(appName)
            if (!acc[key]['nodes'].hasOwnProperty(appName)) {
              acc[key]['nodes'][appName] = {
                label: appName,
                index: 0,
                level: 1,
                nodes: {},
              }
            }

            acc[key]['nodes'][appName]['nodes'][hostName] = {
              label: hostName,
              level: 2,
              index: 0,
            }

            return acc
          }, acc)

          return acc
        },
        {
          'first-level-node-1': {
            label: 'Database',
            index: 0,
            level: 0,
            nodes: {},
          },
          'first-level-node-2': {
            label: 'Middleware',
            index: 1,
            level: 0,
            nodes: {},
          },
          'first-level-node-3': {
            label: 'Web Server',
            index: 3,
            level: 0,
            nodes: {},
          },
          'first-level-node-4': {
            label: 'System Common',
            index: 4,
            level: 0,
            nodes: {},
          },
          'first-level-node-5': {
            label: 'Others',
            index: 5,
            level: 0,
            nodes: {},
          },
        }
      )

      this.setState({ hostsObject: newHosts, appHostData })
    } catch (error) {
      console.error(error)
      notify(notifyUnableToGetApps())
    }
  }

  private getCategoryKeyforApp = (appName: string): string => {
    let category = ''

    switch (appName.toLowerCase()) {
      case 'mysql':
      case 'mssql':
      case 'influxdb':
      case 'mongodb':
      case 'postgresql':
      case 'redis':
      case 'oracle':
        category = 'first-level-node-1'
        break
      case 'activemq':
      case 'rabbitmq':
      case 'kafka':
      case 'zookeeper':
      case 'tomcat':
        category = 'first-level-node-2'
        break
      case 'apache':
      case 'nginx':
      case 'iis':
        category = 'first-level-node-3'
        break
      case 'system':
      case 'win_system':
        category = 'first-level-node-4'
        break
      default:
        category = 'first-level-node-5'
    }

    return category
  }

  private getLayoutsforHostApp = async (
    layouts: Layout[],
    hostID: string,
    appID: string
  ) => {
    const { host, measurements } = await this.fetchHostsAndMeasurements(
      layouts,
      hostID
    )
    const layoutsWithinHost = layouts.filter(layout => {
      return (
        host.apps &&
        host.apps.includes(layout.app) &&
        measurements.includes(layout.measurement)
      )
    })
    const filteredLayouts = layoutsWithinHost
      .filter(layout => {
        return layout.app === appID
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
            ? 1
            : 0
      })

    return { filteredLayouts }
  }

  private fetchHostsAndMeasurements = async (
    layouts: Layout[],
    hostID: string
  ) => {
    const { source } = this.props

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

    return { host, measurements }
  }
}

const mstp = state => {
  const {
    app: {
      persisted: { autoRefresh },
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

export default connect(mstp, mdtp)(ManualRefresh<Props>(Applications))
