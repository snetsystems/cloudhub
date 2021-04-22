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
import {NoState} from 'src/agent_admin/reusable'

//constants
import {VCENTER_DATACENTERS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

// types
import {VMDatacenter} from 'src/hosts/types'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  handleSelectHost: (props) => void
  items: VMDatacenter[]
}

const DatacentersTable = (props: Props): JSX.Element => {
  const {
    isEditable,
    cellTextColor,
    cellBackgroundColor,
    items,
    handleSelectHost,
  } = props

  const {
    DatacenterWidth,
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    ClusterWidth,
    VMHostWidth,
    VMWidth,
  } = VCENTER_DATACENTERS_TABLE_SIZING
  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: DatacenterWidth}}
        >
          Datacenter
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
          style={{width: ClusterWidth}}
        >
          Cluster
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
      <FancyScrollbar>
        {items.map((item) => (
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
              width={DatacenterWidth}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={
                <ProgressDisplay
                  unit={'CPU'}
                  use={item.cpu_usage}
                  available={item.cpu_space}
                  total={item.cpu_usage + item.cpu_space}
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
                  available={item.memory_space}
                  total={item.memory_usage + item.memory_space}
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
              title={item.cluster_count}
              width={ClusterWidth}
              className={'align--end'}
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
          name={'Datacenters'}
          sizeVisible={false}
          setIcon={`icon-margin-right-03 vsphere-icon-datacenter`}
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
            {items ? <Body /> : <NoState message={'There is no Datacenter'} />}
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default DatacentersTable
