// Library
import React, {PureComponent, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import * as d3 from 'd3'

// Component
import KubernetesHeader from 'src/hosts/components/KubernetesHeader'
import KubernetesContents from 'src/hosts/components/KubernetesContents'
import {ComponentStatus} from 'src/reusable_ui'
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

// Actions
import {getKubernetesAllNodesAsync} from 'src/hosts/actions'

//Middleware
import {
  getLocalStorage,
  setLocalStorage,
  verifyLocalStorage,
} from 'src/shared/middleware/localStorage'

// Error
import {ErrorHandling} from 'src/shared/decorators/errors'

// API
import {getCells} from 'src/hosts/utils/getCells'
import {EMPTY_LINKS} from 'src/dashboards/constants/dashboardHeader'
import {generateForHosts} from 'src/utils/tempVars'
// APIs
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHosts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'

// Types
import {Addon} from 'src/types/auth'
import {Source, Layout, TimeRange} from 'src/types'
import {DashboardSwitcherLinks} from 'src/types/dashboards'
import {
  KubernetesItem,
  TooltipNode,
  TooltipPosition,
  FocuseNode,
} from 'src/hosts/types'
import {timeRanges} from 'src/shared/data/timeRanges'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'

interface Props {
  source: Source
  getKubernetesAllNodes: (url: string, token: string) => Promise<string[]>
  addons: Addon[]
  notify: NotificationAction
  manualRefresh: number
}

interface State {
  proportions: number[]
  activeEditorTab: string
  script: string
  labelKey: string
  labelValue: string
  selectedNamespace: string
  selectedNode: string
  selectedLimit: string
  namespaces: string[]
  nodes: string[]
  limits: string[]
  focuseNode: FocuseNode
  pinNode: FocuseNode[]
  isToolipActive: boolean
  tooltipPosition: TooltipPosition
  tooltipNode: TooltipNode
  minions: string[]
  selectMinion: string
  selectedAutoRefresh: AutoRefreshOption['milliseconds']
  isOpenMinions: boolean
  isDisabledMinions: boolean
  kubernetesItem: KubernetesItem
  kubernetesRelationItem: string[]
  layouts: Layout[]
  hostLinks: DashboardSwitcherLinks
  timeRange: TimeRange
}

@ErrorHandling
class KubernetesPage extends PureComponent<Props, State> {
  private height = 40
  private interval: NodeJS.Timer = null

  constructor(props: Props) {
    super(props)

    this.state = {
      proportions: [0.75, 0.25],
      activeEditorTab: 'Basic',
      script: '',
      selectedNamespace: 'All namespaces',
      selectedNode: 'All nodes',
      selectedLimit: 'Unlimited',
      labelKey: '',
      labelValue: '',
      namespaces: ['ns1', 'ns2', 'ns3'],
      nodes: ['n1', 'n2', 'n3'],
      limits: ['Unlimited', '20', '50', '100'],
      focuseNode: {name: null, label: null, type: null},
      pinNode: [],
      isToolipActive: false,
      tooltipPosition: {
        top: null,
        right: null,
        left: null,
      },
      tooltipNode: {
        name: null,
        cpu: null,
        memory: null,
      },
      minions: [],
      selectMinion: null,
      selectedAutoRefresh: 0,
      isOpenMinions: false,
      isDisabledMinions: false,
      kubernetesItem: null,
      kubernetesRelationItem: null,
      layouts: [],
      hostLinks: EMPTY_LINKS,
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
    }
  }

  public async componentDidMount() {
    verifyLocalStorage(getLocalStorage, setLocalStorage, 'KubernetesState', {
      proportions: [0.75, 0.25],
    })
    const getLocal = getLocalStorage('KubernetesState')
    const {proportions} = getLocal
    const dummyData = JSON.parse(
      JSON.stringify(require('src/hosts/containers/d3node.json'), function(
        key,
        value
      ) {
        if (key === 'cpu' || key === 'memory') {
          const test = Math.floor(Math.random() * 100)
          return test
        }
        return value
      })
    )
    this.setState({
      proportions,
      kubernetesItem: dummyData,
    })
  }

  public async componentDidUpdate(_: Props, prevState: State) {
    const {selectedAutoRefresh, selectMinion, focuseNode} = this.state
    if (
      prevState.selectedAutoRefresh !== selectedAutoRefresh ||
      prevState.selectMinion !== selectMinion
    ) {
      this.handleKubernetesAutoRefresh()
    }

    if (prevState.focuseNode.name !== focuseNode.name) {
      const layouts = await this.fillteredLayouts()
      this.setState({
        layouts,
      })
    }
  }

  public componentWillUnmount() {
    this.clearInterval()
  }

  private fillteredLayouts = async () => {
    const {focuseNode} = this.state
    const {
      data: {layouts},
    } = await getLayouts()
    const {host, measurements} = await this.fetchHostsAndMeasurements(layouts)

    let findMeasurement = []
    if (focuseNode.type === 'Node') {
      findMeasurement = [`kubernetes_node`]
    } else if (focuseNode.type === 'Pod') {
      findMeasurement = [`kubernetes_pod`]
    }

    const focusedApp = 'kubernetes'

    let filteredLayouts = _.filter(layouts, layout => {
      return focusedApp
        ? layout.app === focusedApp &&
            _.filter(findMeasurement, m => _.includes(layout.measurement, m))
              .length > 0
        : host.apps &&
            _.includes(host.apps, layout.app) &&
            _.includes(measurements, layout.measurement)
    }).sort((x, y) => {
      return x.measurement < y.measurement
        ? -1
        : x.measurement > y.measurement
        ? 1
        : 0
    })

    const makeWhere = (where: string) => {
      _.forEach(filteredLayouts, layout => {
        _.forEach(layout.cells, cell => {
          _.forEach(cell.queries, query => {
            if (query['wheres']) {
              query['wheres'].push(`"${where}"='${focuseNode.label}'`)
            } else {
              query['wheres'] = []
              query['wheres'].push(`"${where}"='${focuseNode.label}'`)
            }
          })
        })
      })
    }

    if (focuseNode.type === 'Node') {
      makeWhere('node_name')
    } else if (focuseNode.type === 'Pod') {
      makeWhere('pod_name')
    }

    return filteredLayouts
  }

  public render() {
    const {source, manualRefresh} = this.props
    const {
      selectedNamespace,
      selectedNode,
      selectedLimit,
      labelKey,
      labelValue,
      namespaces,
      nodes,
      limits,
      proportions,
      activeEditorTab,
      script,
      focuseNode,
      pinNode,
      isToolipActive,
      tooltipPosition,
      tooltipNode,
      minions,
      selectMinion,
      isOpenMinions,
      isDisabledMinions,
      selectedAutoRefresh,
      timeRange,
      layouts,
    } = this.state

    const layoutCells = getCells(layouts, source)
    const tempVars = generateForHosts(source)

    return (
      <>
        <KubernetesHeader
          handleChooseNamespace={this.onChooseNamespace}
          handleChooseNode={this.onChooseNodes}
          handleChooseLimit={this.onChooseLimit}
          handleChangeLabelkey={this.onChangeLabelKey}
          handleChangeLabelValue={this.onChangeLabelValue}
          handleClickFilter={this.onClickFilter}
          selectedNamespace={selectedNamespace}
          selectedNode={selectedNode}
          selectedLimit={selectedLimit}
          labelKey={labelKey}
          labelValue={labelValue}
          namespaces={namespaces}
          nodes={nodes}
          limits={limits}
          height={this.height}
          minions={minions}
          selectMinion={selectMinion}
          handleChoosMinion={this.onChooseMinion}
          isOpenMinions={isOpenMinions}
          isDisabledMinions={isDisabledMinions}
          minionsStatus={
            isDisabledMinions
              ? ComponentStatus.Loading
              : ComponentStatus.Default
          }
          handleCloseMinionsDropdown={this.handleCloseMinionsDropdown}
          onClickMinionsDropdown={this.onClickMinionsDropdown}
          handleChooseKubernetesAutoRefresh={
            this.handleChooseKubernetesAutoRefresh
          }
          handleKubernetesRefresh={this.debouncedHandleKubernetesRefresh}
          selectedAutoRefresh={selectedAutoRefresh}
        />
        <KubernetesContents
          proportions={proportions}
          activeTab={activeEditorTab}
          handleOnSetActiveEditorTab={this.onSetActiveEditorTab}
          handleOnClickPodName={this.onClickPodName}
          handleOnClickVisualizePod={this.onClickVisualizePod}
          handleResize={this.handleResize}
          focuseNode={focuseNode}
          pinNode={pinNode}
          script={script}
          height={this.height}
          isToolipActive={isToolipActive}
          toolipPosition={tooltipPosition}
          tooltipNode={tooltipNode}
          handleOpenTooltip={this.handleOpenTooltip}
          handleCloseTooltip={this.handleCloseTooltip}
          kubernetesItem={this.state.kubernetesItem}
          kubernetesRelationItem={this.state.kubernetesRelationItem}
          handleDBClick={this.onDBClick}
          source={source}
          sources={[source]}
          cells={layoutCells}
          templates={tempVars}
          timeRange={timeRange}
          manualRefresh={manualRefresh}
          host={''}
          selectMinion={selectMinion}
        />
      </>
    )
  }

  private async fetchHostsAndMeasurements(layouts: Layout[]) {
    const {source} = this.props
    const fetchMeasurements = getMeasurementsForHost(source, '')
    const fetchHosts = getAppsForHost(
      source.links.proxy,
      '',
      layouts,
      source.telegraf
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  private clearInterval = () => {
    window.clearTimeout(this.interval)
    this.interval = null
  }

  private fetchKubernetesData = async (
    url: string,
    token: string,
    minion: string
  ) => {
    console.log('--- fetch start---')
    console.table({url, token, minion})
    console.log('--- fetch end ---')
  }

  private handleKubernetesRefresh = () => {
    const {addons} = this.props
    const {selectMinion} = this.state
    const salt = _.find(addons, addon => addon.name === 'salt')
    this.fetchKubernetesData(salt.url, salt.token, selectMinion)
  }

  private debouncedHandleKubernetesRefresh = _.debounce(
    this.handleKubernetesRefresh,
    500
  )

  private handleKubernetesAutoRefresh = () => {
    const {selectMinion, selectedAutoRefresh} = this.state

    this.clearInterval()
    if (selectMinion === null || selectedAutoRefresh === 0) return

    const {addons} = this.props
    const salt = _.find(addons, addon => addon.name === 'salt')

    this.fetchKubernetesData(salt.url, salt.token, selectMinion)
    this.interval = setTimeout(() => {
      this.handleKubernetesAutoRefresh()
    }, selectedAutoRefresh)
  }

  private handleChooseKubernetesAutoRefresh = ({
    milliseconds,
  }: {
    milliseconds: AutoRefreshOption['milliseconds']
  }) => {
    this.setState({selectedAutoRefresh: milliseconds})
  }

  private onClickMinionsDropdown = async () => {
    const {isOpenMinions, selectMinion} = this.state
    const {getKubernetesAllNodes} = this.props

    if (!isOpenMinions) {
      this.setState({isDisabledMinions: true})
      const salt = _.find(this.props.addons, addon => addon.name === 'salt')
      const minions = _.uniq(await getKubernetesAllNodes(salt.url, salt.token))
      if (_.indexOf(minions, selectMinion) === -1) {
        this.setState({selectMinion: null})
      }

      this.handleOpenMinionsDropdown()
      this.setState({minions, isDisabledMinions: false})
    } else {
      this.handleCloseMinionsDropdown()
    }
  }

  private handleOpenMinionsDropdown = () => {
    this.setState({isOpenMinions: true})
  }

  private handleCloseMinionsDropdown = () => {
    this.setState({isOpenMinions: false})
  }

  private onChooseNamespace = (namespace: {text: string}) => {
    this.setState({selectedNamespace: namespace.text})
  }

  private onChooseNodes = (node: {text: string}) => {
    this.setState({selectedNode: node.text})
  }

  private onChooseLimit = (limit: {text: string}) => {
    this.setState({selectedLimit: limit.text})
  }

  private onChangeLabelKey = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({labelKey: e.target.value})
  }

  private onChangeLabelValue = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({labelValue: e.target.value})
  }

  private onSetActiveEditorTab = (activeEditorTab: string): void => {
    this.setState({
      activeEditorTab,
    })
  }

  private onClickFilter = (): void => {
    console.log('onClick Filter')
  }

  private onClickPodName = (): void => {
    console.log('onClick Pod Name')
  }

  private onClickVisualizePod = (target: SVGSVGElement): void => {
    const focuseNodeName = d3.select(target).attr('data-name')
    const focuseNodeLabel = d3.select(target).attr('data-label')
    const focuseNodeType = d3.select(target).attr('data-type')

    this.setState({
      focuseNode: {
        name: focuseNodeName,
        label: focuseNodeLabel,
        type: focuseNodeType,
      },
    })
  }

  private onDBClick = (target: SVGSVGElement) => {
    this.handlePinNode(target)
  }

  private handlePinNode = (target: SVGSVGElement) => {
    const pinName = d3.select(target).attr('data-name')
    const pinLabel = d3.select(target).attr('data-label')
    const pinType = d3.select(target).attr('data-type')

    this.setState({
      pinNode: [
        {
          name: pinName,
          label: pinLabel,
          type: pinType,
        },
        {
          name:
            'Namespace_ingress-nginx_Configmaps_ingress-controller-leader-nginx',
          label: 'ingress-controller-leader-nginx',
          type: 'Pod',
        },
        {
          name: 'Namespace_kube-public_Configmaps_cluster-info',
          label: 'cluster-info',
          type: 'Pod',
        },
      ],
    })
  }

  private fetchPodData = async () => {
    console.log('hello')
  }

  private debounceFetchPodData = _.debounce(this.fetchPodData, 100)

  private debouncedResizeTrigger = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 250)

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
    setLocalStorage('KubernetesState', {
      proportions,
    })
    this.debouncedResizeTrigger()
  }

  private handleOpenTooltip = (target: HTMLElement) => {
    const {top, right, left} = target.getBoundingClientRect()
    this.setState({
      isToolipActive: true,
      tooltipPosition: {top, right, left},
      tooltipNode: {
        name: target.getAttribute('data-label'),
        cpu: parseInt(target.getAttribute('data-cpu')),
        memory: parseInt(target.getAttribute('data-memory')),
      },
    })
  }

  private handleCloseTooltip = () => {
    this.setState({
      isToolipActive: false,
      tooltipPosition: {top: null, right: null, left: null},
    })
  }

  private onChooseMinion = (minion: {text: string}) => {
    this.setState({selectMinion: minion.text})
  }
}

const mstp = state => ({})

const mdtp = {
  getKubernetesAllNodes: getKubernetesAllNodesAsync,
}

export default connect(mstp, mdtp)(KubernetesPage)
