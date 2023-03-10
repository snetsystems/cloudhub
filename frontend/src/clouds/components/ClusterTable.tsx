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
import {NoState} from 'src/agent_admin/reusable'

// constants
import {VCENTER_CLUSTER_TABLE_SIZING} from 'src/clouds/constants/tableSizing'

// types
import {VMCluster} from 'src/clouds/types'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: VMCluster
}

const ClusterTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props

  const {
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    VMHostWidth,
    VMWidth,
  } = VCENTER_CLUSTER_TABLE_SIZING

  const Header = (): JSX.Element => {
    return (
      <>
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
          style={{width: VMHostWidth}}
        >
          Host(ESXi)
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: VMWidth}}
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
          title={
            <ProgressDisplay
              unit={'CPU'}
              use={item.cpu_usage}
              available={item.cpu_capacity - item.cpu_usage}
              total={item.cpu_capacity}
            />
          }
          width={CPUWidth}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Memory'}
              use={item.memory_usage}
              available={item.memory_capacity - item.memory_usage}
              total={item.memory_capacity}
            />
          }
          width={MemoryWidth}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Storage'}
              use={item.storage_usage}
              available={item.storage_space}
              total={item.storage_capacity}
            />
          }
          width={StorageWidth}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={item.host_count}
          width={VMHostWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={item.vm_count}
          width={VMWidth}
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
          name={item ? `Cluster - ${item.name}` : ''}
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
            {item ? <Body /> : <NoState message={'There is no Cluster'} />}
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default ClusterTable
