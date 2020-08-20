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

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  handleSelectHost: (item: any) => void
  item: any
}

const VMHostsTable = (props: Props): JSX.Element => {
  const {
    isEditable,
    cellTextColor,
    cellBackgroundColor,
    item,
    handleSelectHost,
  } = props

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Host
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
          style={{width: '10%'}}
        >
          VM
        </div>

        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Model
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Processor
        </div>
      </>
    )
  }

  const Body = () => {
    return (
      <FancyScrollbar>
        {item
          ? item.map(i => (
              <div className="hosts-table--tr" key={i.name}>
                <TableBodyRowItem
                  title={
                    <div
                      onClick={() => {
                        handleSelectHost(i)
                      }}
                    >
                      {i.name}
                    </div>
                  }
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={
                    <ProgressDisplay
                      unit={'CPU'}
                      use={i.cpu_usage}
                      available={i.cpu_space}
                      total={i.cpu_capacity}
                    />
                  }
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={
                    <ProgressDisplay
                      unit={'Memory'}
                      use={i.memory_usage}
                      available={i.memory_space}
                      total={i.memory_capacity}
                    />
                  }
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={
                    <ProgressDisplay
                      unit={'Storage'}
                      use={i.storage_usage}
                      available={i.storage_space}
                      total={i.storage_capacity}
                    />
                  }
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={i.vm_count}
                  width={'10%'}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={i.model}
                  width={'10%'}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={i.cpu_name}
                  width={'10%'}
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
          name={'Host(EXSi)'}
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

export default VMHostsTable
