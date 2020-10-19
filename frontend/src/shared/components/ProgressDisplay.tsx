import React from 'react'
import {usageIndacator} from 'src/addon/128t/reusable/layout'
import {transFormatBytes, transFormatFrequency} from 'src/shared/utils/units'

export const eaUnit = (number: any): string => {
  if (
    number === undefined ||
    number === null ||
    number === 'undefined' ||
    number === 'null'
  ) {
    return '-'
  }
  const parseNum = parseInt(number)
  if (parseNum > -1) {
    return `${parseNum} EA`
  }

  return '-'
}

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
        <div>{convertUnit(unit, available)}</div>
      </div>
      <div
        style={{
          display: 'flex',
          padding: '3px 0 5px',
        }}
      >
        {usageIndacator({value: Math.trunc((use / total) * 100) + ' %'})}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between'}}>
        <div>{convertUnit(unit, use)}</div>
        <div>{convertUnit(unit, total)}</div>
      </div>
    </div>
  ) : (
    <>-</>
  )
}
