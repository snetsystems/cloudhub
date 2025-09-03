// Library
import React, {ReactNode} from 'react'
import chroma from 'chroma-js'

// Constants
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

interface Props {
  cellName: ReactNode
  cellBackgroundColor: string
  cellTextColor: string
  children: ReactNode
}

function KubernetesPowerFlexDashboardHeader(props: Props) {
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
      className={
        'dash-graph--draggable dash-graph--heading dash-graph--heading-draggable kubernetes-powerflex-dash-graph--draggable'
      }
      style={{
        margin: 0,
        height: '30px',
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

export default KubernetesPowerFlexDashboardHeader
