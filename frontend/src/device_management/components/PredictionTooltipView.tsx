import React from 'react'
import {HexagonInputData} from 'src/types'
import PredictionTooltip from './PredictionTooltip'
import {statusCal} from '../utils'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {connect} from 'react-redux'

interface Props {
  inputData: HexagonInputData[]
  onHexbinClick: (
    num: number,
    host: string,
    filteredHexbinHost?: string
  ) => void
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
          {inputData.map((tooltip, idx) => {
            return (
              <div
                onClick={e => {
                  e.stopPropagation()
                  onHexbinClick(idx, tooltip.name, filteredHexbinHost)
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

const mdtp = () => ({})

export default connect(mstp, mdtp, null)(PredictionTooltipView)
