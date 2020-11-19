// Library
import React, {PureComponent, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Component
import KubernetesHeader from 'src/hosts/components/KubernetesHeader'
import KubernetesContents from 'src/hosts/components/KubernetesContents'

// Error
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {}
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
}

@ErrorHandling
class KubernetesPage extends PureComponent<Props, State> {
  private height = 40

  constructor(props: Props) {
    super(props)

    this.state = {
      proportions: [0.7, 0.3],
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
      focuseNode: '',
    }
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
  }
}

const mstp = state => {
  return {}
}

const mdtp = {}

export default connect(mstp, mdtp)(KubernetesPage)
