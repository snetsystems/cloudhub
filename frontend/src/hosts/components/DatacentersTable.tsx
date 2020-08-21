import React from 'react'
import _ from 'lodash'
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
import {ProgressDisplay} from 'src/shared/components/ProgressDisplay'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  handleSelectHost: (props) => void
  item: any
}

const DatacentersTable = (props: Props): JSX.Element => {
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
          Datacenter
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
          style={{width: '6.6%'}}
        >
          Cluster
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
        >
          Host(ESXi)
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
        >
          VM
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
                  width={'20%'}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={
                    <ProgressDisplay
                      unit={'CPU'}
                      use={i.cpu_usage}
                      available={i.cpu_space}
                      total={i.cpu_usage + i.cpu_space}
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
                      total={i.memory_usage + i.memory_space}
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
                  title={i.cluster_count}
                  width={'6.6%'}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={i.host_count}
                  width={'6.6%'}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={i.vm_count}
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
          name={'Datacenters'}
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

export default DatacentersTable
