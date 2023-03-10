import React from 'react'
import ReactObserver from 'react-resize-observer'
import _ from 'lodash'

// Components
import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
} from 'src/addon/128t/reusable/layout'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LayoutVMRenderer from 'src/shared/components/LayoutVMRenderer'

// Util
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'

// Types
import {TimeRange, Source} from 'src/types'
import {Item} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'

interface ChartsProps {
  source: Source
  timeRange: TimeRange
  manualRefresh: number
  focusedHost: Item
}

interface DefaultProps {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
}

type Props = DefaultProps & ChartsProps

const ChartsLayoutRenderer = ({
  source,
  timeRange,
  manualRefresh,
  isEditable,
  cellTextColor,
  cellBackgroundColor,
  focusedHost,
}: Props) => {
  const debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 250)

  const handleOnResize = (): void => {
    debouncedFit()
  }

  return (
    <div className={`charts-body`}>
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={[]}
            name={`Charts`}
            sizeVisible={false}
            setIcon={`icon-margin-right-03 icon bar-chart`}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
        </PanelHeader>
        <PanelBody>
          <div style={{position: 'relative', width: '100%', height: '100%'}}>
            <ReactObserver onResize={handleOnResize} />
            <FancyScrollbar>
              <LayoutVMRenderer
                source={source}
                sources={[source]}
                isStatusPage={false}
                isStaticPage={true}
                isEditable={false}
                cells={focusedHost.layoutCells}
                templates={focusedHost.tempVars}
                timeRange={timeRange}
                manualRefresh={manualRefresh}
                vmParam={focusedHost.vmParam}
                vmParentChartField={focusedHost.parent_chart_field}
                vmParentName={focusedHost.parent_name}
              />
            </FancyScrollbar>
          </div>
        </PanelBody>
      </Panel>
    </div>
  )
}

export default React.memo(ChartsLayoutRenderer)
