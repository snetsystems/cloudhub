// Library
import React, {PureComponent, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Component
import KubernetesHeader from 'src/hosts/components/KubernetesHeader'
import KubernetesContents from 'src/hosts/components/KubernetesContents'
import {getKubernetesAllNodes} from 'src/shared/apis/saltStack'
import {ComponentStatus} from 'src/reusable_ui'

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
  addons: Addon[]
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
  intervalTime: string[]
  selectIntervalTime: string
  isOpenMinions: boolean
  isDisabledMinions: boolean
}

@ErrorHandling
class KubernetesPage extends PureComponent<Props, State> {
  private height = 40
  private EMPTY = 'no select'
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
      intervalTime: ['30s', '1m', '5m'],
      selectIntervalTime: '1m',
      isOpenMinions: false,
      isDisabledMinions: false,
    }
  }

  public handleOnClick = async () => {
    const {isOpenMinions, selectMinion} = this.state

    if (!isOpenMinions) {
      this.setState({isDisabledMinions: true})
      const minions = await this.requestKubernetesAllNodes()

      if (_.indexOf(minions, selectMinion) === -1) {
        this.setState({selectMinion: this.EMPTY})
      }

      this.handleOnOpen()
      this.setState({minions, isDisabledMinions: false})
    } else {
      this.handleOnClose()
    }
  }

  public handleOnOpen = () => {
    this.setState({isOpenMinions: true})
  }

  public handleOnClose = () => {
    this.setState({isOpenMinions: false})
  }

  public componentDidMount() {
    verifyLocalStorage(getLocalStorage, setLocalStorage, 'KubernetesState', {
      proportions: [0.75, 0.25],
    })
    const getLocal = getLocalStorage('KubernetesState')
    const {proportions} = getLocal

    this.setState({proportions})
  }

  private requestKubernetesAllNodes = async () => {
    const salt = _.find(this.props.addons, addon => addon.name === 'salt')
    const minions = []
    try {
      const {data} = await getKubernetesAllNodes(salt.url, salt.token)

      _.forEach(_.keys(data.return[0]), k => {
        if (Array.isArray(data.return[0][k]) && data.return[0][k]?.length) {
          minions.push(...data.return[0][k])
        }
      })
    } catch (error) {
      console.error(error)
    }
    return minions
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
      intervalTime,
      selectIntervalTime,
      isOpenMinions,
      isDisabledMinions,
    } = this.state

    return (
      <>
        <KubernetesHeader
          handleOnChooseNamespace={this.onChooseNamespace}
          handleOnChooseNode={this.onChooseNodes}
          handleOnChooseLimit={this.onChooseLimit}
          handleOnChangeLabelkey={this.onChangeLabelKey}
          handleOnChangeLabelValue={this.onChangeLabelValue}
          handleOnClickFilter={this.onClickFilter}
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
          intervalTime={intervalTime}
          selectIntervalTime={selectIntervalTime}
          handleOnChoosMinion={this.onChooseMinion}
          handleOnChoosInterval={this.onChooseInterval}
          isOpenMinions={isOpenMinions}
          isDisabledMinions={isDisabledMinions}
          minionsStatus={
            isDisabledMinions
              ? ComponentStatus.Loading
              : ComponentStatus.Default
          }
          handleOnClose={this.handleOnClose}
          handleOnClick={this.handleOnClick}
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

  private onChooseInterval = (interval: {text: string}) => {
    this.setState({selectIntervalTime: interval.text})
  }
}

const mstp = ({links}) => {
  return {addons: links.addons}
}

const mdtp = {}

export default connect(mstp, mdtp)(KubernetesPage)
