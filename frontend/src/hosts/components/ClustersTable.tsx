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
import {NoHostsState} from 'src/agent_admin/reusable'

//contants
import {VCENTER_CLUSTERS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

// types
import {VMCluster} from 'src/hosts/types'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  items: VMCluster[]
  handleSelectHost: (item: VMCluster) => void
}

const ClustersTable = (props: Props): JSX.Element => {
  const {
    isEditable,
    cellTextColor,
    cellBackgroundColor,
    handleSelectHost,
    items,
  } = props

  const {
    ClusterWidth,
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    VMHostWidth,
    VMWidth,
  } = VCENTER_CLUSTERS_TABLE_SIZING

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: ClusterWidth}}
        >
          Cluster
        </div>
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
          Virtual Machine
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    return (
      <FancyScrollbar>
        {items.map(item => (
          <div className="hosts-table--tr" key={item.name}>
            <TableBodyRowItem
              title={
                <div
                  className={`hosts-table-item`}
                  onClick={() => {
                    handleSelectHost(item)
                  }}
                >
                  {item.name}
                </div>
              }
              width={ClusterWidth}
              className={'align--start'}
            />
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
          name={'Clusters'}
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
          <TableBody>{items.length ? <Body /> : <NoHostsState />}</TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default ClustersTable
