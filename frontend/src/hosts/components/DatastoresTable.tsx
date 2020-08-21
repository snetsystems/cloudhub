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

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
}

const DatastoresTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props
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
        {item
          ? item.map((i, index) => (
              <div className="hosts-table--tr" key={`${i.name}-${index}`}>
                <TableBodyRowItem
                  title={i.name}
                  width={DatastoreWidth}
                  className={'align--start'}
                />
                <TableBodyRowItem
                  title={i.mode}
                  width={StatusWidth}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={i.type}
                  width={TypeWidth}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={convertUnit('Storage', i.capacity)}
                  width={SpaceWidth}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={convertUnit('Storage', i.space)}
                  width={FreeSpaceWidth}
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
          name={'Datastores'}
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

export default DatastoresTable
