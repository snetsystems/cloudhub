import React from 'react'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import PredictionTooltip from 'src/device_management/components/PredictionTooltip'

// Type
import {HexagonInputData} from 'src/types'

// Utils
import {statusCal} from 'src/device_management/utils'

// Redux
import {connect} from 'react-redux'

interface Props {
  inputData: HexagonInputData[]
  onHexbinClick: (host: string, filteredHexbinHost?: string) => void
  //redux
  filteredHexbinHost?: string
  alertHostList?: string[]
}
function PredictionTooltipView({
  inputData,
  filteredHexbinHost,
  alertHostList,
  onHexbinClick,
}: Props) {
  return (
    <>
      <FancyScrollbar style={{height: 'calc(100% - 45px)'}} autoHide={true}>
        <div className="prediction-tooltipView--wrapper">
          {inputData.map(tooltip => {
            return (
              <div
                onClick={e => {
                  e.stopPropagation()
                  onHexbinClick(tooltip.name, filteredHexbinHost)
                }}
                key={tooltip.name}
              >
                <PredictionTooltip
                  cpu={tooltip.cpu}
                  memory={tooltip.memory}
                  traffic={tooltip.traffic}
                  name={tooltip.name}
                  status={statusCal((tooltip.cpu + tooltip.memory) / 2)}
                  isBlink={alertHostList.includes(tooltip.name)}
                  isSelected={filteredHexbinHost === tooltip.name}
                />
              </div>
            )
          })}
        </div>
      </FancyScrollbar>
    </>
  )
}

const mstp = state => {
  const {
    predictionDashboard: {filteredHexbinHost, alertHostList},
  } = state
  return {
    filteredHexbinHost,
    alertHostList,
  }
}

export default connect(mstp, null)(PredictionTooltipView)
