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

  console.log({item})
  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '16.6%'}}
        >
          CPU
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '16.6%'}}
        >
          Memory
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '16.6%'}}
        >
          Storage
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '16.6%'}}
        >
          IP
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '16.6%'}}
        >
          OS
        </div>

        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '16.6%'}}
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
          width={'16.6%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={convertUnit('Memory', memory_usage)}
          width={'16.6%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={convertUnit('Storage', storage_usage)}
          width={'16.6%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={ip_address}
          width={'16.6%'}
          className={'align--center'}
        />
        <TableBodyRowItem title={os} width={'16.6%'} className={'align--end'} />

        <TableBodyRowItem
          title={power_state}
          width={'16.6%'}
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
