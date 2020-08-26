import React from 'react'

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

// Types
import {TimeRange, Cell, Template, Source} from 'src/types'
import {vmParam} from 'src/hosts/containers/VMHostsPage'

interface ChartsProps {
  source: Source
  layoutCells: Cell[]
  tempVars: Template[]
  timeRange: TimeRange
  manualRefresh: number
  hostID: string
  isVMware: boolean
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
  hostID,
  isVMware,
  vmParam,
  vmParentChartField,
  vmParentName,
  isEditable,
  cellTextColor,
  cellBackgroundColor,
}: Props) => {
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
              host={hostID}
              isVMware={isVMware}
              vmParam={vmParam}
              vmParentChartField={vmParentChartField}
              vmParentName={vmParentName}
            />
          </FancyScrollbar>
        </PanelBody>
      </Panel>
    </div>
  )
}

export default ChartsLayoutRenderer
