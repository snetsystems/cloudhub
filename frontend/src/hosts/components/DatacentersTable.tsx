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
  item: any
}

const DatacentersTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props
  console.log({item})
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

  const Body = ({
    name,
    cpuSpace,
    cpuUsage,
    memorySpace,
    memoryUsage,
    storageCapacity,
    storageSpace,
    storageUsage,
    clusterCount,
    hostCount,
    vmCount,
  }: {
    name: string
    cpuSpace: number
    cpuUsage: number
    memorySpace: number
    memoryUsage: number
    storageCapacity: number
    storageSpace: number
    storageUsage: number
    storage: number
    clusterCount: number
    hostCount: number
    vmCount: number
  }): JSX.Element => {
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
              use={cpuUsage}
              available={cpuSpace}
              total={cpuUsage + cpuSpace}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Memory'}
              use={memoryUsage}
              available={memorySpace}
              total={memoryUsage + memorySpace}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Storage'}
              use={storageUsage}
              available={storageSpace}
              total={storageCapacity}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={clusterCount}
          width={'6.6%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={hostCount}
          width={'6.6%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={vmCount}
          width={'6.6%'}
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
            <FancyScrollbar>
              {item
                ? item.map(i => (
                    <Body
                      key={i.name}
                      name={i.name}
                      cpuSpace={i.cpu_space}
                      cpuUsage={i.cpu_usage}
                      memorySpace={i.memory_space}
                      memoryUsage={i.memory_usage}
                      storageCapacity={i.storage_capacity}
                      storageSpace={i.storage_space}
                      storageUsage={i.storage_usage}
                      clusterCount={i.cluster_count}
                      hostCount={i.host_count}
                      vmCount={i.vm_count}
                    />
                  ))
                : null}
            </FancyScrollbar>
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default DatacentersTable
