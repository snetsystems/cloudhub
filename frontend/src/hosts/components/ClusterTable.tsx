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

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
}

const ClusterTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props
  const {
    name,
    cpu_usage,
    cpu_capacity,
    memory_usage,
    memory_capacity,
    storage_usage,
    storage_space,
    storage_capacity,
    host_count,
    vm_count,
  } = item

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Cluster
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
          Host(ESXi)
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          VM
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={name}
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'CPU'}
              use={cpu_usage}
              available={cpu_capacity - cpu_usage}
              total={cpu_capacity}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Memory'}
              use={memory_usage}
              available={memory_capacity - memory_usage}
              total={memory_capacity}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Storage'}
              use={storage_usage}
              available={storage_space}
              total={storage_capacity}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={host_count}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={vm_count}
          width={'10%'}
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
          name={'Cluster'}
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

export default ClusterTable
