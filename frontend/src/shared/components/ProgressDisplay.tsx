import React from 'react'
import {Line} from 'rc-progress'
import 'rc-progress/assets/index.css'

export const ProgressDisplay = ({unit, use, available, total}) => {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '9px',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between'}}>
        <div>{unit}</div>
        <div>available: {available}</div>
      </div>
      <div style={{width: '100%'}}>
        <Line
          // strokeLinecap={'square'}
          percent={Math.trunc((use / total) * 100)}
          strokeWidth={3}
          trailWidth={3}
        />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between'}}>
        <div>use: {use}</div>
        <div>total: {total}</div>
      </div>
    </div>
  )
}
