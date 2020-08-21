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
import {convertUnit} from 'src/shared/components/ProgressDisplay'
import {responseIndicator} from 'src/shared/components/Indicator'
import {VCENTER_VM_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
}

const VirtualMachineTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props
  const {
    name,
    cpu_usage,
    memory_usage,
    os,
    storage_usage,
    power_state,
    ip_address,
  } = item

  const {
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    IPWidth,
    OSWidth,
    StatusWidth,
  } = VCENTER_VM_TABLE_SIZING

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
          style={{width: IPWidth}}
        >
          IP
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: OSWidth}}
        >
          OS
        </div>

        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: StatusWidth}}
        >
          Power Status
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={convertUnit('CPU', cpu_usage)}
          width={CPUWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={convertUnit('Memory', memory_usage)}
          width={MemoryWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={convertUnit('Storage', storage_usage)}
          width={StorageWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={ip_address}
          width={IPWidth}
          className={'align--start'}
        />
        <TableBodyRowItem
          title={os}
          width={OSWidth}
          className={'align--start'}
        />

        <TableBodyRowItem
          title={responseIndicator(power_state === 'poweredOn')}
          width={StatusWidth}
          className={'align--center'}
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
          name={`Virtual Machine (${name})`}
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

export default VirtualMachineTable
