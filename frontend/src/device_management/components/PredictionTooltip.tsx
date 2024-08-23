import React from 'react'

// Components
import {
  Table,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'
import {PredictionTooltipNode} from 'src/types'
import {PredictionTooltipIndicator} from 'src/device_management/components/PredictionTootipIndicator'

// Constants
import {
  PREDICTION_TOOLTIP_TABLE_SIZING,
  TOOLTIP_WIDTH,
} from 'src/device_management/constants'
import {PREDICTION_TOOLTIP_HEADER} from 'src/device_management/constants/prediction'

interface Props extends PredictionTooltipNode {
  status?: string
  isBlink?: boolean
  isSelected?: boolean
}
function PredictionTooltip({
  cpu,
  memory,
  name,
  traffic,
  status,
  isBlink,
  isSelected = true,
}: Props) {
  const {
    TABLE_ROW_IN_HEADER,
    TABLE_ROW_IN_BODY,
  } = PREDICTION_TOOLTIP_TABLE_SIZING

  return (
    <div
      style={{minWidth: TOOLTIP_WIDTH}}
      className={`prediction-tooltip-content ${isSelected ? '' : 'grey'}`}
    >
      <div className={isBlink ? `prediction-tooltip--blink` : ''}>
        <Table>
          <TableBody>
            <>
              <div className={'hosts-table--tr header'}>
                <div
                  className={'hosts-table--th'}
                  style={{width: PREDICTION_TOOLTIP_HEADER}}
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
                  className="prediction"
                  title={PredictionTooltipIndicator({
                    value: cpu === -1 ? 'NA' : `${cpu}%`,
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
                  className="prediction"
                  title={PredictionTooltipIndicator({
                    value: memory === -1 ? 'NA' : `${memory}%`,
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
                  className="prediction"
                  title={PredictionTooltipIndicator({
                    value: traffic,
                    status: status,
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
            </>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default PredictionTooltip
