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
import {TOPOLOGY_TOOLTIP_TABLE_SIZING} from 'src/hosts/constants/topology'

// types
import {TemperatureTooltip} from 'src/hosts/types/preferences'

interface Props {
  targetPosition: {width: number; top: number; right: number; left: number}
  tooltipNode: Partial<TemperatureTooltip>
}
export default function TopologyTooltip({targetPosition, tooltipNode}: Props) {
  const {hostname, temperature, cpu, memory, disk, dataType} = tooltipNode || {}
  const {TABLE_ROW_IN_HEADER, TABLE_ROW_IN_BODY} = TOPOLOGY_TOOLTIP_TABLE_SIZING

  return (
    <div
      className={classnames('topology-table-container router-node')}
      style={{
        position: 'fixed',
        width: '240px',
        height: '150px',
        top: targetPosition.top,
        left: targetPosition.left,
      }}
    >
      <div style={{display: 'flex'}}>
        <strong style={{flex: 1}} className={'hosts-table-title'}>
          {hostname}
        </strong>
        <span
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#ffffff78',
            fontSize: '0.58rem',
            paddingRight: '8px',
            fontStyle: 'italic',
          }}
        >
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
                {temperature.title}
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
          </>
        </TableBody>
      </Table>
    </div>
  )
}
