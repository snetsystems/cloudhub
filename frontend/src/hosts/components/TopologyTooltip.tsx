// libraries
import React from 'react'
import classnames from 'classnames'

// components
import {
  Table,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'
import {TopologyTooltipIndacator} from 'src/hosts/components/TopologyTooltipIndacator'

// constatns
import {
  inletText,
  TOPOLOGY_TOOLTIP_TABLE_SIZING,
} from 'src/hosts/constants/topology'

// types
import {TemperatureTooltip} from 'src/hosts/types/preferences'

interface Props {
  targetPosition: {width: number; top: number; right: number; left: number}
  tooltipNode: Partial<TemperatureTooltip>
}
export default function TopologyTooltip({targetPosition, tooltipNode}: Props) {
  const {hostname, temperature, cpu, memory, disk, dataType, extraTag} =
    tooltipNode || {}
  const {TABLE_ROW_IN_HEADER, TABLE_ROW_IN_BODY} = TOPOLOGY_TOOLTIP_TABLE_SIZING

  return (
    <div
      style={{
        position: 'fixed',
        width: '240px',
        top: targetPosition.top,
        left: targetPosition.left,
      }}
    >
      <div className={classnames('topology-table-container router-node')}>
        <div style={{display: 'flex'}}>
          <strong style={{flex: 1}} className={'hosts-table-title'}>
            {hostname}
          </strong>
          <span className="tooltip-data-type">
            from {dataType.toUpperCase() === 'IPMI' ? 'IPMI' : 'Agent'}
          </span>
        </div>
        <Table>
          <TableBody>
            <>
              <div className={'hosts-table--tr'}>
                <div
                  className={'hosts-table--th'}
                  style={{width: TABLE_ROW_IN_HEADER}}
                >
                  {temperature.title === inletText ? (
                    <>
                      {temperature.title}
                      <span className="tooltip-cpu-count">
                        {`#${extraTag.cpuCount ?? 1}`}
                      </span>
                    </>
                  ) : (
                    temperature.title
                  )}
                </div>
                <TableBodyRowItem
                  title={TopologyTooltipIndacator({
                    value: temperature.value,
                    status: temperature.status,
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
              <div className={'hosts-table--tr'}>
                <div
                  className={'hosts-table--th'}
                  style={{width: TABLE_ROW_IN_HEADER}}
                >
                  {cpu.title}
                </div>
                <TableBodyRowItem
                  title={TopologyTooltipIndacator({
                    value: cpu.value,
                    status: cpu.status,
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
              <div className={'hosts-table--tr'}>
                <div
                  className={'hosts-table--th'}
                  style={{width: TABLE_ROW_IN_HEADER}}
                >
                  {memory.title}
                </div>
                <TableBodyRowItem
                  title={TopologyTooltipIndacator({
                    value: memory.value,
                    status: memory.status,
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
              <div className={'hosts-table--tr'}>
                <div
                  className={'hosts-table--th'}
                  style={{width: TABLE_ROW_IN_HEADER}}
                >
                  {disk.title}
                </div>
                <TableBodyRowItem
                  title={TopologyTooltipIndacator({
                    value: disk.value,
                    status: disk.status,
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
              {dataType.toUpperCase() !== 'IPMI' && extraTag?.diskPath && (
                <div className={'hosts-table--tr'}>
                  <span className="tooltip-disk-path">
                    Disk path: {extraTag?.diskPath}
                  </span>
                </div>
              )}
            </>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
