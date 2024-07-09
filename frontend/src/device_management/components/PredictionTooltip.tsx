import React, {memo} from 'react'
// components
import {
  Table,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'

import {TOPOLOGY_TOOLTIP_TABLE_SIZING} from 'src/hosts/constants/topology'
import {PredictionTooltipNode} from 'src/types'
import {PredictionTooltipIndicator} from './PredictionTootipIndicator'

interface Props extends PredictionTooltipNode {
  status?: string
}
function PredictionTooltip({cpu, memory, name, traffic, status}: Props) {
  const {TABLE_ROW_IN_HEADER, TABLE_ROW_IN_BODY} = TOPOLOGY_TOOLTIP_TABLE_SIZING

  return (
    <>
      <Table>
        <TableBody>
          <>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th'}
                style={{width: TABLE_ROW_IN_HEADER}}
              >
                {name}
              </div>
            </div>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th'}
                style={{width: TABLE_ROW_IN_HEADER}}
              >
                {'cpu'}
              </div>
              <TableBodyRowItem
                title={PredictionTooltipIndicator({
                  value: cpu,
                  status: status,
                })}
                width={TABLE_ROW_IN_BODY}
              ></TableBodyRowItem>
            </div>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th'}
                style={{width: TABLE_ROW_IN_HEADER}}
              >
                {'memory'}
              </div>
              <TableBodyRowItem
                title={PredictionTooltipIndicator({
                  value: memory,
                  status: status,
                })}
                width={TABLE_ROW_IN_BODY}
              ></TableBodyRowItem>
            </div>
            <div className={'hosts-table--tr'}>
              <div
                className={'hosts-table--th'}
                style={{width: TABLE_ROW_IN_HEADER}}
              >
                {'traffic'}
              </div>
              <TableBodyRowItem
                title={PredictionTooltipIndicator({
                  value: traffic,
                  status: null,
                })}
                width={TABLE_ROW_IN_BODY}
              ></TableBodyRowItem>
            </div>
          </>
        </TableBody>
      </Table>
    </>
  )
}

export default PredictionTooltip
