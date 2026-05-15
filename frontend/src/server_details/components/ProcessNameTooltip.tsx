import React from 'react'
import {TooltipData} from 'src/server_details/types/ProcessLineChartTable-tooltip'

interface TooltipProps {
  tooltipData: TooltipData
}

const ProcessNameTooltip = ({tooltipData}: TooltipProps) => {
  const {x, y, row} = tooltipData
  const processName = String(row?.process_name ?? '')
  const user = row?.user as string | undefined

  return (
    <div
      className="process-name-tooltip"
      style={{
        left: x + 10,
        top: y,
      }}
    >
      <span className="process-name-with-user">
        <span className="process-name-with-user__name">{processName}</span>
        {user ? (
          <span className="process-name-with-user__user">{String(user)}</span>
        ) : null}
      </span>
    </div>
  )
}

export default ProcessNameTooltip
