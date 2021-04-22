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
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {NoState} from 'src/agent_admin/reusable'

// contants
import {VCENTER_VMHOSTS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

// types
import {Item} from 'src/reusable_ui/components/treemenu'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  handleSelectHost: (item: Item) => void
  items: Item[]
}

const VMHostsTable = (props: Props): JSX.Element => {
  const {
    isEditable,
    cellTextColor,
    cellBackgroundColor,
    items,
    handleSelectHost,
  } = props

  const {
    VMHostWidth,
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    VMWidth,
    VMModelWidth,
    VMProcessorWidth,
  } = VCENTER_VMHOSTS_TABLE_SIZING

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: VMHostWidth}}
        >
          Host
        </div>
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

  const Body = () => {
    return (
      <FancyScrollbar>
        {items.map(item => (
          <div className="hosts-table--tr" key={item.name}>
            <TableBodyRowItem
              title={
                <div
                  className={`hosts-table-item`}
                  onClick={() => {
                    handleSelectHost(item)
                  }}
                >
                  {item.name}
                </div>
              }
              width={VMHostWidth}
              className={'align--start'}
            />
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
              className={'align--center'}
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
              title={item.vm_count}
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
              className={'align--start'}
            />
          </div>
        ))}
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
          name={'Host(ESXi)'}
          sizeVisible={false}
          setIcon={`icon-margin-right-03 vsphere-icon-host`}
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
            {items.length ? <Body /> : <NoState message={`There is no Host`} />}
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default VMHostsTable
