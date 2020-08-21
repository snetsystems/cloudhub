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
import {ProgressDisplay} from 'src/shared/components/ProgressDisplay'
import {VCENTER_VMHOST_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
}

const VMHostTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props
  const {
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    VMWidth,
    VMModelWidth,
    VMProcessorWidth,
  } = VCENTER_VMHOST_TABLE_SIZING
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
          style={{width: VMWidth}}
        >
          VM
        </div>

        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: VMModelWidth}}
        >
          Model
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: VMProcessorWidth}}
        >
          Processor
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'CPU'}
              use={item.cpu_usage}
              available={item.cpu_space}
              total={item.cpu_capacity}
            />
          }
          width={CPUWidth}
          className={'align--start'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Memory'}
              use={item.memory_usage}
              available={item.memory_space}
              total={item.memory_capacity}
            />
          }
          width={MemoryWidth}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Storage'}
              use={item.storage_usage}
              available={item.storage_space}
              total={item.storage_capacity}
            />
          }
          width={StorageWidth}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={'5'}
          width={VMWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={item.model}
          width={VMModelWidth}
          className={'align--start'}
        />
        <TableBodyRowItem
          title={item.cpu_name}
          width={VMProcessorWidth}
          className={'align--end'}
        />
      </div>
    )
  }

  return (
    <Panel>
      <PanelHeader isEditable={isEditable}>
        <CellName
          cellTextColor={cellTextColor}
          cellBackgroundColor={cellBackgroundColor}
          value={[]}
          name={'Host(EXSi)'}
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

export default VMHostTable
