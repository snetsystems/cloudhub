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

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
}

const DatastoresTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Datastore
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Run Status
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Type
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Space
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
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
          ? item.map(i => (
              <div className="hosts-table--tr" key={i.name}>
                <TableBodyRowItem
                  title={i.name}
                  width={'20%'}
                  className={'align--start'}
                />
                <TableBodyRowItem
                  title={i.mode}
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={i.type}
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={i.capacity}
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={i.space}
                  width={'20%'}
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
