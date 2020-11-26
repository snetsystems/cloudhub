// Library
import React, {PureComponent, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

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

interface Props {
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
  focuseNode: string
  isToolipActive: boolean
  tooltipPosition: {top: number; right: number; left: number}
  tooltipNode: {name: string; cpu: number; memory: number}
  minions: string[]
  selectMinion: string
  selectedAutoRefresh: AutoRefreshOption['milliseconds']
  isOpenMinions: boolean
  isDisabledMinions: boolean
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
      focuseNode: this.EMPTY,
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
    }
  }

  public componentDidMount() {
    verifyLocalStorage(getLocalStorage, setLocalStorage, 'KubernetesState', {
      proportions: [0.75, 0.25],
    })
    const getLocal = getLocalStorage('KubernetesState')
    const {proportions} = getLocal

    this.setState({proportions})
  }

  public componentDidUpdate(_: Props, prevState: State) {
    const {selectedAutoRefresh, selectMinion} = this.state
    if (
      prevState.selectedAutoRefresh !== selectedAutoRefresh ||
      prevState.selectMinion !== selectMinion
    ) {
      this.handleKubernetesAutoRefresh()
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
          handleKubernetesRefresh={this.handleKubernetesRefresh}
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
          script={script}
          height={this.height}
          isToolipActive={isToolipActive}
          toolipPosition={tooltipPosition}
          tooltipNode={tooltipNode}
          handleOpenTooltip={this.handleOpenTooltip}
          handleCloseTooltip={this.handleCloseTooltip}
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

  private onClickVisualizePod = (focuseNode: string): void => {
    this.setState({focuseNode})
  }

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
        name: target.getAttribute('data-name'),
        cpu: parseInt(target.getAttribute('data-testCPU')),
        memory: parseInt(target.getAttribute('data-testMemory')),
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

const mstp = ({links}) => {
  return {addons: links.addons}
}

const mdtp = {
  getKubernetesAllNodes: getKubernetesAllNodesAsync,
}

export default connect(mstp, mdtp)(KubernetesPage)
