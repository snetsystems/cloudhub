// Library
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Component
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ButtonShape, Radio} from 'src/reusable_ui'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'

import KubernetesBasicsTable from 'src/hosts/components/KubernetesBasicsTable'
import KubernetesRawData from 'src/hosts/components/KubernetesRawData'
import KubernetesTooltip from 'src/hosts/components/KubernetesTooltip'
import KubernetesHexagon from 'src/hosts/components/KubernetesHexagon'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {NoHostsState} from 'src/addon/128t/reusable'

// Constants
import {HANDLE_VERTICAL} from 'src/shared/constants'
import {KUBERNETES_BASICS_TABLE_SIZE} from 'src/hosts/constants/tableSizing'
import {kubernetesStatusColor} from 'src/hosts/constants/color'

// Types
import {
  TooltipNode,
  TooltipPosition,
  FocuseNode,
  D3K8sData,
  KubernetesObject,
} from 'src/hosts/types'
import {Source, TimeRange, Cell, Template, RemoteDataState} from 'src/types'

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickPodName: () => void
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

  private KubernetesVisualize = () => {
    const {
      source,
      sources,
      cells,
      templates,
      timeRange,
      manualRefresh,
      host,
      focuseNode,
      pinNode,
      kubernetesObject,
      kubernetesD3Data,
      handleDBClick,
      handleOnClickPodName,
      handleOnClickVisualizePod,
      handleResize,
      handleOpenTooltip,
      handleCloseTooltip,
    } = this.props

    return (
      <FancyScrollbar>
        <div style={{width: '100%', height: 'calc(100% - 50px)'}}>
          <KubernetesHexagon
            kubernetesObject={kubernetesObject}
            kubernetesD3Data={kubernetesD3Data}
            focuseNode={focuseNode}
            pinNode={pinNode}
            handleDBClick={handleDBClick}
            handleOnClickPodName={handleOnClickPodName}
            handleOnClickVisualizePod={handleOnClickVisualizePod}
            handleResize={handleResize}
            handleOpenTooltip={handleOpenTooltip}
            handleCloseTooltip={handleCloseTooltip}
            remoteDataState={this.props.remoteDataState}
          />

          {this.tooltip}
        </div>
        {focuseNode.name && cells.length > 0 ? (
          <div className="kubernetes-dashboard">
            <LayoutRenderer
              source={source}
              sources={sources}
              isStatusPage={false}
              isStaticPage={true}
              isEditable={false}
              cells={cells}
              templates={templates}
              timeRange={timeRange}
              manualRefresh={manualRefresh}
              host={host}
            />
          </div>
        ) : (
          <NoHostsState style={{height: '50px'}} />
        )}
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
    const {
      handleOnSetActiveEditorTab,
      handleOnClickPodName,
      activeTab,
      script,
      focuseNode,
    } = this.props
    const {HeaderWidth, DataWidth} = KUBERNETES_BASICS_TABLE_SIZE

    return (
      <FancyScrollbar>
        <div className="kubernetes-detail-display">
          <TableBody>
            <>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth}}
                >
                  Kind
                </div>
                <TableBodyRowItem
                  title={
                    <div className="pod-name" onClick={handleOnClickPodName}>
                      {focuseNode.type}
                    </div>
                  }
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
              <div className="hosts-table--tr">
                <div
                  className={'hosts-table--th align--start'}
                  style={{width: HeaderWidth}}
                >
                  Label
                </div>
                <TableBodyRowItem
                  title={
                    <div className="pod-name" onClick={handleOnClickPodName}>
                      {focuseNode.label}
                    </div>
                  }
                  width={DataWidth}
                  className={'align--start'}
                />
              </div>
            </>
          </TableBody>
          <div className={'kubernetes-detail-title'}>Raw Data</div>
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

export default KubernetesContents
