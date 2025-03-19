import React from 'react'

// Components
import {
  Table,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'
import {GPUMonitoringTooltipIndicator} from 'src/gpu_monitoring/components/GPUMonitoringTooltipIndicator'

// Constants
import {
  GPU_MONITORING_TOOLTIP_TABLE_SIZING,
  GPU_MONITORING_TOOLTIP_HEADER,
  GPU_MONITORING_TOOLTIP_WIDTH,
  GPU_MONITORING_TOOLTIP_BODY_FONTSIZE,
  GPU_MONITORING_TOOLTIP_BODY_PADDING,
} from 'src/gpu_monitoring/constants'

// Type
import {NVidiaSmiMonitoringTooltipNode} from 'src/types'

interface Props extends NVidiaSmiMonitoringTooltipNode {
  status?: string
  isSelected?: boolean
}

function NVidiaDataMonitoringTooltip({rows, name, isSelected = true}: Props) {
  const {
    TABLE_ROW_IN_HEADER,
    TABLE_ROW_IN_BODY,
  } = GPU_MONITORING_TOOLTIP_TABLE_SIZING

  const formatValue = (value: number): string =>
    value === -1 ? 'N/A' : `${value.toFixed(1)}%`

  return (
    <div
      style={{minWidth: GPU_MONITORING_TOOLTIP_WIDTH}}
      className={`gpu-monitoring-tooltip-content ${isSelected ? '' : 'grey'}`}
    >
      <div>
        <Table>
          <TableBody>
            <>
              <div className="hosts-table--tr header" style={{height: '24px'}}>
                <div
                  className="hosts-table--th"
                  style={{width: GPU_MONITORING_TOOLTIP_HEADER, padding: '2px'}}
                >
                  {name}
                </div>
              </div>
              {rows.map(row => (
                <div
                  className="hosts-table--tr"
                  style={{height: '22px'}}
                  key={row.title}
                >
                  <div
                    className="hosts-table--th"
                    style={{
                      width: TABLE_ROW_IN_HEADER,
                      fontSize: GPU_MONITORING_TOOLTIP_BODY_FONTSIZE,
                      padding: GPU_MONITORING_TOOLTIP_BODY_PADDING,
                    }}
                  >
                    {row.title}
                  </div>
                  <TableBodyRowItem
                    title={GPUMonitoringTooltipIndicator({
                      tooltipText: formatValue(row.value),
                      value: row.value,
                      originalValue: row?.originalValue,
                      isTemperatureMetrics: row?.isTemperatureMetrics,
                    })}
                    width={TABLE_ROW_IN_BODY}
                    className="gpu-monitoring-tooltip--td"
                  />
                </div>
              ))}
            </>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default NVidiaDataMonitoringTooltip
