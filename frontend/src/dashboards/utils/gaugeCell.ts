import {COLOR_TYPE_MAX} from 'src/shared/constants/thresholds'
import {ColorNumber, ColorString, ColorStop} from 'src/types/colors'

export const clampPercent = (percent: number): number =>
  Math.max(0, Math.min(100, percent))

export const buildEvenColorStops = (colors: ColorString[]): ColorStop[] => {
  if (!colors.length) {
    return []
  }

  if (colors.length === 1) {
    return [
      {color: colors[0], percent: 0},
      {color: colors[0], percent: 100},
    ]
  }

  return colors.map((color, index) => ({
    color,
    percent: clampPercent((index / (colors.length - 1)) * 100),
  }))
}

export const buildThresholdColorStops = (
  colors: ColorNumber[],
  min: number,
  max: number
): ColorStop[] => {
  if (!colors.length) {
    return []
  }

  const range = max - min || 1

  const stopsWithValues = colors
    .map((color, index) => {
      if (
        index === colors.length - 1 &&
        colors.length > 2 &&
        color.type === COLOR_TYPE_MAX
      ) {
        return null
      }
      const numericValue = Number(color.value)
      return {color, numericValue, index}
    })
    .filter(stop => !!stop)

  const numericValues = stopsWithValues
    .map(stop => stop.numericValue)
    .filter(value => Number.isFinite(value))

  const hasDistinctValues =
    numericValues.length >= 2 &&
    new Set(numericValues.map(value => Number(value))).size > 1

  const stopsWithOrder = stopsWithValues.map(stop => {
    const percent =
      hasDistinctValues && Number.isFinite(stop.numericValue)
        ? clampPercent(((Number(stop.numericValue) - min) / range) * 100)
        : clampPercent((stop.index / Math.max(colors.length - 1, 1)) * 100)

    return {color: stop.color, percent, order: stop.index}
  })

  return stopsWithOrder
    .sort((a, b) => a.percent - b.percent || a.order - b.order)
    .map(({color, percent}) => ({color, percent}))
}

export const buildGradientStops = (colorStops: ColorStop[]): string[] =>
  colorStops.map(stop => `${stop.color.hex} ${stop.percent}%`)

export const buildSolidGradientStops = (colorStops: ColorStop[]): string[] => {
  const normalized = normalizeStops(colorStops)

  if (!normalized.length) {
    return []
  }

  return normalized.flatMap((stop, index) => {
    const start = stop.percent
    const end =
      index === normalized.length - 1 ? 100 : normalized[index + 1].percent

    return [`${stop.color.hex} ${start}%`, `${stop.color.hex} ${end}%`]
  })
}

export const getGradientColorForPercent = (
  percent: number,
  colorStops: ColorStop[]
): string => {
  if (colorStops.length === 0) {
    return '#00bfdd'
  }

  if (colorStops.length === 1) {
    return colorStops[0].color.hex
  }

  const clampedPercent = clampPercent(percent)

  const sortedStops = [...colorStops].sort((a, b) => a.percent - b.percent)

  if (clampedPercent <= sortedStops[0].percent) {
    return sortedStops[0].color.hex
  }

  for (let i = 0; i < sortedStops.length - 1; i++) {
    const start = sortedStops[i]
    const end = sortedStops[i + 1]

    if (clampedPercent <= end.percent) {
      const span = Math.max(end.percent - start.percent, 1)
      const t = (clampedPercent - start.percent) / span

      const startRgb = hexToRgb(start.color.hex)
      const endRgb = hexToRgb(end.color.hex)

      if (!startRgb || !endRgb) {
        return start.color.hex
      }

      const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * t)
      const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * t)
      const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * t)

      return rgbToHex(r, g, b)
    }
  }

  return sortedStops[sortedStops.length - 1].color.hex
}

export const getSolidColorForPercent = (
  percent: number,
  colorStops: ColorStop[]
): string => {
  if (colorStops.length === 0) {
    return '#00bfdd'
  }

  const clampedPercent = clampPercent(percent)
  const sortedStops = normalizeStops(colorStops)

  let currentColor = sortedStops[0].color.hex

  for (let i = 0; i < sortedStops.length; i++) {
    if (clampedPercent >= sortedStops[i].percent) {
      currentColor = sortedStops[i].color.hex
    } else {
      break
    }
  }

  return currentColor
}

export const normalizeStops = (colorStops: ColorStop[]): ColorStop[] => {
  if (!colorStops.length) {
    return []
  }

  const sorted = [...colorStops].sort((a, b) => a.percent - b.percent)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const withBounds = [...sorted]

  if (first.percent > 0) {
    withBounds.unshift({color: first.color, percent: 0})
  }

  if (last.percent < 100) {
    withBounds.push({color: last.color, percent: 100})
  }

  return withBounds
}

export const hexToRgb = (
  hex: string
): {r: number; g: number; b: number} | null => {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(normalized, 16)
  if (Number.isNaN(bigint)) {
    return null
  }

  if (normalized.length === 3) {
    const r = (bigint >> 8) & 0xf
    const g = (bigint >> 4) & 0xf
    const b = bigint & 0xf

    return {
      r: (r << 4) | r,
      g: (g << 4) | g,
      b: (b << 4) | b,
    }
  }

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  }
}

export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (value: number) => {
    const clamped = Math.max(0, Math.min(255, value))
    const hex = clamped.toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export const formatDisplayValue = (
  value: number | null,
  isPercent: boolean,
  decimalPlaces: number
): string => {
  if (!Number.isFinite(value) || value === null) {
    return '--'
  }

  if (isPercent) {
    return `${value.toFixed(1)}%`
  }

  if (value === 0) {
    return '0'
  }

  const absValue = Math.abs(value)

  if (absValue < 10000) {
    if (!decimalPlaces) {
      return value.toString()
    }

    if (absValue >= 1) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: Math.max(decimalPlaces, 0),
        maximumFractionDigits: decimalPlaces,
      })
    }
    return value.toPrecision(decimalPlaces)
  }

  return value.toExponential(decimalPlaces)
}
