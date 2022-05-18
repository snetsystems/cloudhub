import React from 'react'
import {PureComponent} from 'react'
import {Page} from 'src/reusable_ui'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Layout, Source, TimeRange} from 'src/types'
import {generateForHosts} from 'src/utils/tempVars'
import {Instance} from '../types'
import {getCells} from '../utils/getCells'
import Dropdown from 'src/shared/components/Dropdown'
interface State {}

interface Props extends ManualRefreshProps {
  source: Source
  timeRange: TimeRange
  focusedHost: string
  agentFilterItems: string[]
  selectedAgent: string

  awsFocusedInstance: Instance
  activeCspTab: string
  filteredLayouts: Layout[]
  getHandleOnChoose: (selectItem: {text: string}) => void
}
interface State {}

@ErrorHandling
class AwsHostRenderGraph extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      source,
      manualRefresh,
      timeRange,
      filteredLayouts,
      agentFilterItems,
      selectedAgent,
      awsFocusedInstance,
      getHandleOnChoose,
    } = this.props
    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)
    return (
      <>
        <Page.Header>
          <Page.Header.Left>
            <></>
          </Page.Header.Left>
          <Page.Header.Right>
            <>
              <span>
                Get from <span style={{margin: '0 3px'}}>:</span>
              </span>
              <Dropdown
                items={agentFilterItems}
                onChoose={getHandleOnChoose}
                selected={selectedAgent}
                className="dropdown-sm"
                disabled={false}
              />
            </>
          </Page.Header.Right>
        </Page.Header>

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
            manualRefresh={manualRefresh}
            host={''}
            instance={awsFocusedInstance}
          />
        </Page.Contents>
      </>
    )
  }
}
export default AwsHostRenderGraph
