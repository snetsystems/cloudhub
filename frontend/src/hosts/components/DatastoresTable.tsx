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
import {convertUnit} from 'src/shared/components/ProgressDisplay'
import {VCENTER_DATASTORES_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {NoState} from 'src/agent_admin/reusable'
import {Item} from 'src/reusable_ui/components/treemenu'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  items: Item[]
}

const DatastoresTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, items} = props
  const {
    DatastoreWidth,
    StatusWidth,
    TypeWidth,
    SpaceWidth,
    FreeSpaceWidth,
  } = VCENTER_DATASTORES_TABLE_SIZING
  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: DatastoreWidth}}
        >
          Datastore
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: StatusWidth}}
        >
          Run Status
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: TypeWidth}}
        >
          Type
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: SpaceWidth}}
        >
          Space
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: FreeSpaceWidth}}
        >
          Free Space
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    return (
      <FancyScrollbar>
        {items.map((item, index) => (
          <div className="hosts-table--tr" key={`${item.name}-${index}`}>
            <TableBodyRowItem
              title={item.name}
              width={DatastoreWidth}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={item.mode}
              width={StatusWidth}
              className={'align--center'}
            />
            <TableBodyRowItem
              title={item.type}
              width={TypeWidth}
              className={'align--center'}
            />
            <TableBodyRowItem
              title={convertUnit('Storage', item.capacity)}
              width={SpaceWidth}
              className={'align--end'}
            />
            <TableBodyRowItem
              title={convertUnit('Storage', item.space)}
              width={FreeSpaceWidth}
              className={'align--end'}
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
          name={'Datastores'}
          sizeVisible={false}
          setIcon={`icon-margin-right-03 vsphere-icon-datastore`}
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
            {items.length ? (
              <Body />
            ) : (
              <NoState message={'There is no Datastore'} />
            )}
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default DatastoresTable
