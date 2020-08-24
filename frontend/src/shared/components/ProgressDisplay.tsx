import React from 'react'
import {Line} from 'rc-progress'
import 'rc-progress/assets/index.css'
import {transFormatBytes, transFormatFrequency} from 'src/shared/utils/units'

export const convertUnit = (unit: string, value: number) => {
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
  return unit && use && available && total ? (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '9px',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'flex-end'}}>
        <div>{convertUnit(unit, total)}</div>
      </div>
      <div
        style={{
          display: 'flex',
          padding: '3px 0 5px',
        }}
      >
        <Line
          percent={Math.trunc((use / total) * 100)}
          strokeWidth={3}
          trailWidth={3}
          style={{height: '3px', width: '100%'}}
        />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between'}}>
        <div>{convertUnit(unit, use)}</div>
        <div>{convertUnit(unit, available)}</div>
      </div>
    </div>
  ) : (
    <>-</>
  )
}