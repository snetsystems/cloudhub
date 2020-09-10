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
import {TimeRange, Cell, Template, Source} from 'src/types'
import {vmParam} from 'src/hosts/containers/VMHostsPage'

interface ChartsProps {
  source: Source
  layoutCells: Cell[]
  tempVars: Template[]
  timeRange: TimeRange
  manualRefresh: number
  vmParam: vmParam
  vmParentChartField: string
  vmParentName: string
}

interface DefaultProps {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
}

type Props = DefaultProps & ChartsProps

const ChartsLayoutRenderer = ({
  source,
  layoutCells,
  tempVars,
  timeRange,
  manualRefresh,
  vmParam,
  vmParentChartField,
  vmParentName,
  isEditable,
  cellTextColor,
  cellBackgroundColor,
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
                cells={layoutCells}
                templates={tempVars}
                timeRange={timeRange}
                manualRefresh={manualRefresh}
                vmParam={vmParam}
                vmParentChartField={vmParentChartField}
                vmParentName={vmParentName}
              />
            </FancyScrollbar>
          </div>
        </PanelBody>
      </Panel>
    </div>
  )
}

export default React.memo(ChartsLayoutRenderer)
