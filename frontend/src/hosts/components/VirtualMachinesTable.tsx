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
import {VCENTER_VMS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  handleSelectHost: (item: any) => void
  item: any
}

const VirtualMachinesTable = (props: Props): JSX.Element => {
  const {
    isEditable,
    cellTextColor,
    cellBackgroundColor,
    item,
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
        {item
          ? item.map(i => (
              <div className="hosts-table--tr" key={uuid.v4()}>
                <TableBodyRowItem
                  title={
                    <div
                      className={`hosts-table-item`}
                      onClick={() => {
                        handleSelectHost(i)
                      }}
                    >
                      {i.name}
                    </div>
                  }
                  width={VMWidth}
                  className={'align--start'}
                />
                <TableBodyRowItem
                  title={convertUnit('CPU', i.cpu_usage)}
                  width={CPUWidth}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={convertUnit('Memory', i.memory_usage)}
                  width={MemoryWidth}
                  className={'align--end'}
                />

                <TableBodyRowItem
                  title={convertUnit('Storage', i.storage_usage)}
                  width={StorageWidth}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={i.ip_address}
                  width={IPWidth}
                  className={'align--start'}
                />
                <TableBodyRowItem
                  title={i.os}
                  width={OSWidth}
                  className={'align--start'}
                />
                <TableBodyRowItem
                  title={responseIndicator(i.power_state === 'poweredOn')}
                  width={StatusWidth}
                  className={'align--center'}
                />
              </div>
            ))
          : null}
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
          <TableBody>
            <Body />
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default VirtualMachinesTable
