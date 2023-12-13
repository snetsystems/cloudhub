import React from 'react'
import {CSSProperties, ReactNode} from 'react'

interface Props {
  children: ReactNode
  containerStyle?: CSSProperties
}

export const ChartContainer = ({children, containerStyle}: Props) => {
  return (
    <div
      className="static-graph-chart-wrapper"
      style={{
        ...containerStyle,
      }}
    >
      <div>{children}</div>
    </div>
  )
}

export default ChartContainer
