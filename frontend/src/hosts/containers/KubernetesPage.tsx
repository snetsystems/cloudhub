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

// Types
import {Addon} from 'src/types/auth'
import {Source} from 'src/types'
import {
  KubernetesItem,
  TooltipNode,
  TooltipPosition,
  FocuseNode,
} from 'src/hosts/types'

interface Props {
  source: Source
  getKubernetesAllNodes: (url: string, token: string) => Promise<string[]>
  addons: Addon[]
  notify: NotificationAction
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
}

@ErrorHandling
class KubernetesPage extends PureComponent<Props, State> {
  private height = 40
  private EMPTY = 'no select'
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
      focuseNode: {name: this.EMPTY, label: this.EMPTY},
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
      selectMinion: this.EMPTY,
      selectedAutoRefresh: 0,
      isOpenMinions: false,
      isDisabledMinions: false,
      kubernetesItem: null,
      kubernetesRelationItem: null,
    }
  }

  public componentDidMount() {
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
    this.setState({proportions, kubernetesItem: dummyData})
  }

  public componentDidUpdate(_: Props, prevState: State) {
    const {selectedAutoRefresh, selectMinion, focuseNode} = this.state
    if (
      prevState.selectedAutoRefresh !== selectedAutoRefresh ||
      prevState.selectMinion !== selectMinion
    ) {
      this.handleKubernetesAutoRefresh()
    }
    if (prevState.focuseNode !== focuseNode && focuseNode.name !== this.EMPTY) {
      this.debounceFetchPodData()
    }
  }

  public componentWillUnmount() {
    this.clearInterval()
  }

  public render() {
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
    } = this.state

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
        />
      </>
    )
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
    if (selectMinion === this.EMPTY || selectedAutoRefresh === 0) return

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
        this.setState({selectMinion: this.EMPTY})
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
    console.log({focuseNodeName, focuseNodeLabel})
    this.setState({focuseNode: {name: focuseNodeName, label: focuseNodeLabel}})
  }

  private onDBClick = (target: SVGSVGElement) => {
    this.handlePinNode(target)
  }

  private handlePinNode = (target: SVGSVGElement) => {
    const pinName = d3.select(target).attr('data-name')
    const pinLabel = d3.select(target).attr('data-label')

    this.setState({
      pinNode: [
        {
          name: pinName,
          label: pinLabel,
        },
        {
          name:
            'Namespace_ingress-nginx_Configmaps_ingress-controller-leader-nginx',
          label: 'ingress-controller-leader-nginx',
        },
        {
          name: 'Namespace_kube-public_Configmaps_cluster-info',
          label: 'cluster-info',
        },
      ],
    })
  }

  private fetchPodData = async () => {
    console.log('hello')
  }

  private debounceFetchPodData = _.debounce(this.fetchPodData, 100)

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
    setLocalStorage('KubernetesState', {
      proportions,
    })
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
