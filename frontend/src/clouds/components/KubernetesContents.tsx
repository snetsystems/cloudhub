// Library
import React, {PureComponent} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'

// Component
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'
import KubernetesDashboardSection from 'src/clouds/components/KubernetesDashboardSection'
import KubernetesPowerFlexDashboard from 'src/clouds/components/KubernetesPowerFlexDashboard'

import KubernetesBasicsTable from 'src/clouds/components/KubernetesBasicsTable'
import KubernetesRawData from 'src/clouds/components/KubernetesRawData'
import KubernetesTooltip from 'src/clouds/components/KubernetesTooltip'
import KubernetesHexagon from 'src/clouds/components/KubernetesHexagon'

// Constants
import {HANDLE_VERTICAL} from 'src/shared/constants'
import {KUBERNETES_BASICS_TABLE_SIZE} from 'src/clouds/constants/tableSizing'
import {kubernetesStatusColor} from 'src/clouds/constants/color'

// Types
import {
  TooltipNode,
  TooltipPosition,
  FocuseNode,
  D3K8sData,
  KubernetesObject,
} from 'src/clouds/types'
import {Source, TimeRange, Cell, Template, RemoteDataState} from 'src/types'
import KubernetesPodDashboardSection from './KubernetesPodDashboardSection'
import {Layout} from 'src/types/hosts'

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickVisualizePod: (data: any) => void
  handleDBClick: (data: any) => void
  handleResize: (proportions: number[]) => void
  handleOpenTooltip: (target: any) => void
  handleCloseTooltip: () => void
  proportions: number[]
  activeTab: string
  script: string
  height: number
  focuseNode: FocuseNode
  pinNode: string[]
  isToolipActive: boolean
  targetPosition: TooltipPosition
  tooltipNode: TooltipNode
  kubernetesObject: KubernetesObject
  kubernetesD3Data: D3K8sData
  source: Source
  sources: Source[]
  templates: Template[]
  timeRange: TimeRange
  cells: Cell[]
  manualRefresh: number
  host: string
  selectMinion: string
  remoteDataState: RemoteDataState
  selectedPersistentVolume?: string[] | null
  highlightVolumes: string[]
  layouts: Layout[]
}

interface State {}

class KubernetesContents extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {}
  }

  public render() {
    const {height, handleResize} = this.props
    return (
      <div style={{height: `calc(100% - ${height}px)`}}>
        <Threesizer
          orientation={HANDLE_VERTICAL}
          divisions={this.virticalDivisions}
          onResize={handleResize}
        />
      </div>
    )
  }

  private get virticalDivisions() {
    const {proportions} = this.props
    const [leftSize, rightSize] = proportions

    return [
      {
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.KubernetesVisualize,
        headerOrientation: HANDLE_VERTICAL,
        size: leftSize,
      },
      {
        name: 'Details',
        headerButtons: [],
        menuOptions: [],
        render: this.KubernetesInformation,
        headerOrientation: HANDLE_VERTICAL,
        size: rightSize,
      },
    ]
  }

  private renderBottomSection = () => {
    const {
      source,
      sources,
      cells,
      templates,
      timeRange,
      manualRefresh,
      host,
      focuseNode,
      selectedPersistentVolume,
      layouts,
    } = this.props

    if (focuseNode.type === 'Pod') {
      return (
        <KubernetesPodDashboardSection
          source={source}
          timeRange={timeRange}
          manualRefresh={manualRefresh}
          podLayouts={layouts}
        />
      )
    }

    if (selectedPersistentVolume && selectedPersistentVolume.length > 0) {
      return (
        <KubernetesPowerFlexDashboard
          source={source}
          timeRange={timeRange}
          manualRefresh={manualRefresh}
        />
      )
    }

    return (
      <KubernetesDashboardSection
        source={source}
        sources={sources}
        cells={cells}
        templates={templates}
        timeRange={timeRange}
        manualRefresh={manualRefresh}
        host={host}
        focuseNode={focuseNode}
      />
    )
  }

  private KubernetesVisualize = () => {
    const {
      kubernetesObject,
      kubernetesD3Data,
      focuseNode,
      pinNode,
      handleDBClick,
      handleOnClickVisualizePod,
      handleResize,
      handleOpenTooltip,
      handleCloseTooltip,
      highlightVolumes,
    } = this.props

    return (
      <FancyScrollbar>
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 50px)',
            paddingBottom: '8px',
            backgroundColor: '#292933',
            borderBottom: '4px solid #1F1F27',
          }}
        >
          <KubernetesHexagon
            kubernetesObject={kubernetesObject}
            kubernetesD3Data={kubernetesD3Data}
            focuseNode={focuseNode}
            pinNode={pinNode}
            handleDBClick={handleDBClick}
            handleOnClickVisualizePod={handleOnClickVisualizePod}
            handleResize={handleResize}
            handleOpenTooltip={handleOpenTooltip}
            handleCloseTooltip={handleCloseTooltip}
            remoteDataState={this.props.remoteDataState}
            highlightVolumes={highlightVolumes}
          />

          {this.tooltip}
        </div>

        {this.renderBottomSection()}
      </FancyScrollbar>
    )
  }

  private get tooltip() {
    const {isToolipActive, targetPosition, tooltipNode} = this.props
    if (isToolipActive) {
      return (
        <KubernetesTooltip
          targetPosition={targetPosition}
          tooltipNode={tooltipNode}
          statusColor={kubernetesStatusColor}
        />
      )
    }
  }

  private KubernetesInformation = () => {
    const {activeTab, script, focuseNode} = this.props
    const {HeaderWidth, DataWidth} = KUBERNETES_BASICS_TABLE_SIZE

    return (
      <FancyScrollbar>
        <div className="kubernetes-detail-display">
          <TableBody>
            <>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth, padding: '4px 8px'}}
                >
                  Kind
                </div>
                <TableBodyRowItem
                  title={<div className="k8s-obj-kind">{focuseNode.type}</div>}
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth, padding: '4px 8px'}}
                >
                  Name
                </div>
                <TableBodyRowItem
                  title={
                    <div className="k8s-obj-label">{focuseNode.label}</div>
                  }
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
            </>
          </TableBody>
          <div className={'kubernetes-detail-title'}>Details</div>
          {activeTab === 'Basic' ? (
            <KubernetesBasicsTable />
          ) : (
            <KubernetesRawData script={script} />
          )}
        </div>
      </FancyScrollbar>
    )
  }
}

const mstp = state => {
  const {
    kubernetesPowerFlexDashboard: {selectedPersistentVolume},
  } = state
  return {
    selectedPersistentVolume,
  }
}

export default connect(mstp)(KubernetesContents)
