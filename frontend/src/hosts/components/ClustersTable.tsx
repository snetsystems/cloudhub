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
import {VCENTER_CLUSTERS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: any
  handleSelectHost: (i: any) => void
}

const ClustersTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor, item} = props
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

  const Body = ({handleSelectHost}): JSX.Element => {
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
                  width={ClusterWidth}
                  className={'align--start'}
                />
                <TableBodyRowItem
                  title={
                    <ProgressDisplay
                      unit={'CPU'}
                      use={i.cpu_usage}
                      available={i.cpu_capacity - i.cpu_usage}
                      total={i.cpu_capacity}
                    />
                  }
                  width={CPUWidth}
                  className={'align--center'}
                />
                <TableBodyRowItem
                  title={
                    <ProgressDisplay
                      unit={'Memory'}
                      use={i.memory_usage}
                      available={i.memory_capacity - i.memory_usage}
                      total={i.memory_capacity}
                    />
                  }
                  width={MemoryWidth}
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
                  width={StorageWidth}
                  className={'align--center'}
                />

                <TableBodyRowItem
                  title={i.host_count}
                  width={VMHostWidth}
                  className={'align--end'}
                />
                <TableBodyRowItem
                  title={i.vm_count}
                  width={VMWidth}
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
          <TableBody>
            <Body handleSelectHost={props.handleSelectHost} />
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default ClustersTable
