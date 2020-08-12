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
}

const DatastoresTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor} = props
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
        <div className="hosts-table--tr">
          <TableBodyRowItem
            title={'datastore'}
            width={'20%'}
            className={'align--start'}
          />
          <TableBodyRowItem
            title={'status'}
            width={'20%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={'type'}
            width={'20%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={'space'}
            width={'20%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={'freeSpace'}
            width={'20%'}
            className={'align--center'}
          />
        </div>
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
