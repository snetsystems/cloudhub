import React, {ReactNode} from 'react'
import chroma from 'chroma-js'

// constants
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

interface Props {
  cellName: string
  cellBackgroundColor: string
  cellTextColor: string
  children: ReactNode
  setModalOpen?: (value: boolean) => void
}

function PredictionDashboardHeader(props: Props) {
  const cellName = (): JSX.Element => {
    const {cellName, cellTextColor, cellBackgroundColor} = props

    let nameStyle = {}

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      nameStyle = {
        color: cellTextColor,
      }
    }

    return (
      <span className={'dash-graph--name'} style={nameStyle}>
        {cellName}
      </span>
    )
  }

  const headingBar = (): JSX.Element => {
    const {cellBackgroundColor} = props

    let barStyle

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      barStyle = {
        backgroundColor: chroma(cellBackgroundColor).brighten(),
      }
    }

    return (
      <>
        <div className="dash-graph--heading-bar" style={barStyle} />
        <div className="dash-graph--heading-dragger" />
      </>
    )
  }

  return (
    <div
      onMouseDown={() => props.setModalOpen(false)}
      className={
        'dash-graph--heading dash-graph--heading-draggable prediction-dash-graph--draggable'
      }
      style={{
        margin: 0,
        height: '40px',
        backgroundColor: '#292933',
        zIndex: 6,
      }}
    >
      {cellName()}
      {props.children}
      {headingBar()}
    </div>
  )
}

export default PredictionDashboardHeader
