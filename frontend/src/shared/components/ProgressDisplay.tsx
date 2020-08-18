import React from 'react'
import {Line} from 'rc-progress'
import 'rc-progress/assets/index.css'
import {transFormatBytes, transFormatFrequency} from 'src/shared/utils/units'

export const convertUnit = (unit, value) => {
  console.log(unit)
  console.log(value)
  if (unit && value) {
    if (unit === 'CPU') {
      return transFormatFrequency(value, 2)
    } else {
      return transFormatBytes(value, 2)
    }
  } else {
    return null
  }
}

export const ProgressDisplay = ({unit, use, available, total}) => {
  console.log(unit)
  console.log({use, available, total})

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
        <div>available: {convertUnit(unit, available)}</div>
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
        <div>use: {convertUnit(unit, use)}</div>
        <div>total: {convertUnit(unit, total)}</div>
      </div>
    </div>
  )
}
