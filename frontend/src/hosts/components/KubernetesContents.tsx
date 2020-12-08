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
  KubernetesItem,
  TooltipNode,
  TooltipPosition,
  FocuseNode,
} from 'src/hosts/types'
import {Source, TimeRange, Cell, Template} from 'src/types'

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickPodName: () => void
  handleOnClickVisualizePod: (target: SVGSVGElement) => void
  handleDBClick: (target: SVGSVGElement) => void
  handleResize: (proportions: number[]) => void
  handleOpenTooltip: (target: any) => void
  handleCloseTooltip: () => void
  proportions: number[]
  activeTab: string
  script: string
  height: number
  focuseNode: FocuseNode
  pinNode: FocuseNode[]
  isToolipActive: boolean
  toolipPosition: TooltipPosition
  tooltipNode: TooltipNode
  kubernetesItem: KubernetesItem
  kubernetesRelationItem: string[]
  source: Source
  sources: Source[]
  templates: Template[]
  timeRange: TimeRange
  cells: Cell[]
  manualRefresh: number
  host: string
  selectMinion: string
}

interface State {}

class KubernetesContents extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {}
  }

  public render() {
    return (
      <div style={{height: `calc(100% - ${this.props.height}px)`}}>
        <Threesizer
          orientation={HANDLE_VERTICAL}
          divisions={this.virticalDivisions}
          onResize={this.props.handleResize}
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
    } = this.props

    return (
      <FancyScrollbar>
        <div style={{width: '100%', height: 'calc(100% - 50px)'}}>
          <KubernetesHexagon
            data={this.props.kubernetesItem}
            focuseNode={this.props.focuseNode}
            pinNode={this.props.pinNode}
            handleDBClick={this.props.handleDBClick}
            handleOnClickPodName={this.props.handleOnClickPodName}
            handleOnClickVisualizePod={this.props.handleOnClickVisualizePod}
            handleResize={this.props.handleResize}
            handleOpenTooltip={this.props.handleOpenTooltip}
            handleCloseTooltip={this.props.handleCloseTooltip}
          />

          {this.tooltip}
        </div>
        {focuseNode.name !== null && cells.length > 0 ? (
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
    if (this.props.isToolipActive) {
      return (
        <KubernetesTooltip
          tipPosition={this.props.toolipPosition}
          tooltipNode={this.props.tooltipNode}
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
          <div className={'kubernetes-radio-btn--container'}>
            <Radio shape={ButtonShape.StretchToFit}>
              <Radio.Button
                id="hostspage-tab-Basic"
                titleText="Basic"
                value="Basic"
                active={activeTab === 'Basic'}
                onClick={handleOnSetActiveEditorTab}
              >
                Basic
              </Radio.Button>
              <Radio.Button
                id="hostspage-tab-Detail"
                titleText="Detail"
                value="Detail"
                active={activeTab === 'Detail'}
                onClick={handleOnSetActiveEditorTab}
              >
                Raw Data
              </Radio.Button>
            </Radio>
          </div>
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
