import React from 'react'
import uuid from 'uuid'

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
import {convertUnit} from 'src/shared/components/ProgressDisplay'
import {responseIndicator} from 'src/shared/components/Indicator'
import {NoHostsState} from 'src/agent_admin/reusable'

//contants
import {VCENTER_VMS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

//types
import {VM} from 'src/hosts/types'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  handleSelectHost: (item: VM) => void
  items: VM[]
}

const VirtualMachinesTable = (props: Props): JSX.Element => {
  const {
    isEditable,
    cellTextColor,
    cellBackgroundColor,
    items,
    handleSelectHost,
  } = props

  const {
    VMWidth,
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    IPWidth,
    OSWidth,
    StatusWidth,
  } = VCENTER_VMS_TABLE_SIZING

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: VMWidth}}
        >
          VM
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
      <FancyScrollbar>
        {items.map(item => (
          <div className="hosts-table--tr" key={uuid.v4()}>
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
              width={VMWidth}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={convertUnit('CPU', item.cpu_usage)}
              width={CPUWidth}
              className={'align--end'}
            />
            <TableBodyRowItem
              title={convertUnit('Memory', item.memory_usage)}
              width={MemoryWidth}
              className={'align--end'}
            />

            <TableBodyRowItem
              title={convertUnit('Storage', item.storage_usage)}
              width={StorageWidth}
              className={'align--end'}
            />
            <TableBodyRowItem
              title={item.ip_address}
              width={IPWidth}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={item.os}
              width={OSWidth}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={responseIndicator(item.power_state === 'poweredOn')}
              width={StatusWidth}
              className={'align--center'}
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
          name={`Virtual Machine `}
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
          <TableBody>{items.length ? <Body /> : <NoHostsState />}</TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default VirtualMachinesTable
