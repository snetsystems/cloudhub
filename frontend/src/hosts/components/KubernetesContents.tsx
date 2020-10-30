import React, {PureComponent} from 'react'

// Component
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ButtonShape, Radio} from 'src/reusable_ui'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'

import KubernetesBasicsTable from 'src/hosts/components/KubernetesBasicsTable'
import KubernetesRawData from 'src/hosts/components/KubernetesRawData'

// Constants
import {HANDLE_VERTICAL} from 'src/shared/constants'
import {KUBERNETES_BASICS_TABLE_SIZE} from 'src/hosts/constants/tableSizing'

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickPodName: () => void
  handleResize: (proportions: number[]) => void
  proportions: number[]
  activeTab: string
  script: string
  height: number
}

class KubernetesContents extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
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
    return <div>K8sInventoryVisual</div>
  }

  private KubernetesInformation = () => {
    const {
      handleOnSetActiveEditorTab,
      handleOnClickPodName,
      activeTab,
      script,
    } = this.props
    const {HeaderWidth, DataWidth} = KUBERNETES_BASICS_TABLE_SIZE

    return (
      <FancyScrollbar>
        <div className="kubernetes-detail-display">
          <TableBody>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Pod
              </div>
              <TableBodyRowItem
                title={
                  <div className="pod-name" onClick={handleOnClickPodName}>
                    {`kubernetes-dashboard-78fcd5ddd-4j4s4`}
                  </div>
                }
                width={DataWidth}
                className={'align--start'}
              />
            </div>
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
