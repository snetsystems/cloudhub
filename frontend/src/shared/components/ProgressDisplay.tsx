import React from 'react'
import convert from 'convert-units'
import {Line} from 'rc-progress'
import 'rc-progress/assets/index.css'

export const convertUnit = (unit, value) => {
  console.log(unit)
  console.log(value)
  if (unit && value) {
    if (unit === 'CPU') {
      const {val, unit} = convert(value)
        .from('Hz')
        .toBest()
      console.log('progress: ', val)
      return `${val.toFixed(2)} ${unit}`
    } else {
      const {val, unit} = convert(value)
        .from('B')
        .toBest()
      console.log('progress: ', val)
      return `${val.toFixed(2)} ${unit}`
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
