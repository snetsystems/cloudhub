import React from 'react'
import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
  Table,
  TableHeader,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {VCENTER_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {ProgressDisplay} from 'src/shared/components/ProgressDisplay'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
}

const VcenterTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props

  const {
    cpu_usage,
    cpu_space,
    host_count,
    nodes,
    memory_usage,
    memory_space,
    storage_usage,
    storage_space,
    storage_capacity,
    vm_count,
  } = item

  const {
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    DatacenterWidth,
    VMHostWidth,
    VMWidth,
  } = VCENTER_TABLE_SIZING
  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: CPUWidth}}
        >
          CPU
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: MemoryWidth}}
        >
          Memory
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: StorageWidth}}
        >
          Storage
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: DatacenterWidth}}
        >
          Datacenter
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: VMHostWidth}}
        >
          Host(ESXi)
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: VMWidth}}
        >
          VM
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    return (
      <FancyScrollbar>
        <div className="hosts-table--tr">
          <TableBodyRowItem
            title={
              <ProgressDisplay
                unit={'CPU'}
                use={cpu_usage}
                available={cpu_space}
                total={cpu_usage + cpu_space}
              />
            }
            width={CPUWidth}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={
              <ProgressDisplay
                unit={'Memory'}
                use={memory_usage}
                available={memory_space}
                total={memory_usage + memory_space}
              />
            }
            width={MemoryWidth}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={
              <ProgressDisplay
                unit={'Storage'}
                use={storage_usage}
                available={storage_space}
                total={storage_capacity}
              />
            }
            width={StorageWidth}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={nodes ? nodes.length : null}
            width={DatacenterWidth}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={host_count}
            width={VMHostWidth}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={vm_count}
            width={VMWidth}
            className={'align--end'}
          />
        </div>
      </FancyScrollbar>
    )
  }

  return (
    <Panel>
      <PanelHeader isEditable={isEditable}>
        <CellName
          cellTextColor={cellTextColor}
          cellBackgroundColor={cellBackgroundColor}
          value={[]}
          name={`vCenter - ${item.label}`}
          sizeVisible={false}
        />
        <HeadingBar
          isEditable={isEditable}
          cellBackgroundColor={cellBackgroundColor}
        />
      </PanelHeader>
      <PanelBody>
        <Table>
          <TableHeader>
            <Header />
          </TableHeader>
          <TableBody>
            <Body />
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default VcenterTable
