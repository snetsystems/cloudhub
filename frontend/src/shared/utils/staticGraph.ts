import _ from 'lodash'
import {Axes} from 'src/types'

export const convertToStaticGraphMinMaxValue = (value: string) => {
  return /^-?\d+(\.\d+)?$/.test(value) && _.isFinite(_.toNumber(value))
    ? _.toNumber(value)
    : undefined
}

export const formatStaticGraphValue = (axes: Axes, value: number) => {
  let formattedValue

  switch (axes?.y?.base) {
    case 'raw':
      if (value >= 1e5) {
        formattedValue = value.toExponential(2)
      } else {
        formattedValue = value
      }
      break
    case '10':
      if (value >= 1e9) {
        formattedValue = (value / 1e9).toFixed(2) + ' B'
      } else if (value >= 1e6) {
        formattedValue = (value / 1e6).toFixed(2) + ' M'
      } else if (value >= 1e3) {
        formattedValue = (value / 1e3).toFixed(2) + ' K'
      } else {
        formattedValue = value
      }
      break
    case '2':
    default:
      if (value >= 1024 * 1024 * 1024) {
        formattedValue = (value / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
      } else if (value >= 1024 * 1024) {
        formattedValue = (value / (1024 * 1024)).toFixed(2) + ' MB'
      } else if (value >= 1024) {
        formattedValue = (value / 1024).toFixed(2) + ' KB'
      } else {
        formattedValue = value + ' B'
      }
      break
  }

  const prefix = axes?.y?.prefix ? axes.y.prefix : ''
  const suffix = axes?.y?.suffix ? axes.y.suffix : ''
  return prefix + formattedValue + suffix
}
