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

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
}

const VirtualMachinesTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          VM
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          CPU
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Memory
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Storage
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          IP
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
        >
          OS
        </div>

        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
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
                  title={i.name}
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={convertUnit('CPU', i.cpu_usage)}
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={convertUnit('Memory', i.memory_usage)}
                  width={'20%'}
                  className={'align--center'}
                />

                <TableBodyRowItem
                  title={convertUnit('Storage', i.storage_usage)}
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={i.ip_address}
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={i.os}
                  width={'6.6%'}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={i.power_state}
                  width={'6.6%'}
                  className={'align--end'}
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
