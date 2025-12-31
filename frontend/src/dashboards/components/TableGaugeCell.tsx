// Libraries
import React, {useEffect, useRef, useState} from 'react'
import _ from 'lodash'

// Utils
import {
  buildEvenColorStops,
  buildThresholdColorStops,
  buildGradientStops,
  buildSolidGradientStops,
  getSolidColorForPercent,
  formatDisplayValue,
  getGradientColorForPercent,
} from 'src/dashboards/utils/gaugeCell'

// Constants
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {DEFAULT_GAUGE_COLORS} from 'src/shared/constants/thresholds'

// Types
import {
  BACKGROUND_TYPE_MODES,
  CHART_TYPE_MODES,
  BackgroundTypeMode,
} from 'src/types/statisticalgraph'
import {ColorNumber, ColorString, ColorStop} from 'src/types/colors'
import {GaugeOptions} from 'src/types'

interface Props {
  options: GaugeOptions
  value: number
}

const getSegmentCountForWidth = (width: number): number => {
  if (!width || width <= 0) {
    return 50
  }

  if (width < 120) {
    return 20
  }

  if (width < 220) {
    return 35
  }

  return 50
}

function TableGaugeCell({options, value}: Props) {
  const gaugeRef = useRef<HTMLDivElement>(null)
  const [segmentCount, setSegmentCount] = useState<number>(50)

  useEffect(() => {
    const element = gaugeRef.current
    if (!element) {
      return
    }

    const updateSegmentCount = () => {
      const width = element.getBoundingClientRect().width
      setSegmentCount(getSegmentCountForWidth(width))
    }

    updateSegmentCount()

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateSegmentCount)
      resizeObserver.observe(element)

      return () => {
        resizeObserver.disconnect()
      }
    }

    window.addEventListener('resize', updateSegmentCount)
    return () => {
      window.removeEventListener('resize', updateSegmentCount)
    }
  }, [])

  const parsedValue =
    typeof value === 'number' ? value : !_.isNaN(value) ? Number(value) : NaN
  const numericValue = Number.isFinite(parsedValue) ? parsedValue : 0

  const max = options?.max ?? 100

  const min = options?.min ?? 0

  const range = max - min || 1

  const percentage = ((numericValue - min) / range) * 100

  const clampedPercentage = Math.max(0, Math.min(100, percentage))

  const gradientColors: ColorString[] = options?.colors?.length
    ? options.colors
    : DEFAULT_LINE_COLORS

  const solidColors: ColorNumber[] = options?.thresholdColors?.length
    ? options.thresholdColors
    : DEFAULT_GAUGE_COLORS

  const gradientColorStops = buildEvenColorStops(gradientColors)

  const solidColorStops = buildThresholdColorStops(solidColors, min, max)

  const backgroundType =
    options?.backgroundType ?? BACKGROUND_TYPE_MODES.GRADIENT

  const isGradientBackground = backgroundType === BACKGROUND_TYPE_MODES.GRADIENT

  const gradientStops = isGradientBackground
    ? buildGradientStops(gradientColorStops)
    : buildSolidGradientStops(solidColorStops)

  const barGradient = gradientStops.length
    ? `linear-gradient(90deg, ${gradientStops.join(', ')})`
    : ''

  const solidBarColor = getSolidColorForPercent(
    clampedPercentage,
    solidColorStops
  )

  const textColor = isGradientBackground
    ? getGradientColorForPercent(clampedPercentage, gradientColorStops)
    : getSolidColorForPercent(clampedPercentage, solidColorStops)

  const backgroundSize =
    barGradient && clampedPercentage > 0
      ? `${(100 / clampedPercentage) * 100}% 100%`
      : undefined

  const chartType = options?.chartType ?? CHART_TYPE_MODES.CONTINUOUS

  const isPercent = options?.isPercent ?? true

  const decimalPlaces = Number.isFinite(options?.decimalPlaces)
    ? Math.max(0, options.decimalPlaces)
    : 1

  const rawValueForDisplay = isPercent ? clampedPercentage : numericValue

  const valueToDisplay = Number.isFinite(rawValueForDisplay)
    ? rawValueForDisplay
    : null

  const formattedValue = formatDisplayValue(
    valueToDisplay,
    isPercent,
    decimalPlaces
  )

  return (
    <div className="table-gauge-cell-container">
      <div
        ref={gaugeRef}
        className={`table-gauge-cell-gauge${
          chartType === CHART_TYPE_MODES.SEGMENTED
            ? ' table-gauge-cell-gauge--segmented'
            : ''
        }`}
      >
        {chartType === CHART_TYPE_MODES.SEGMENTED ? (
          <div className="table-gauge-cell-segments">
            {buildSegments(
              clampedPercentage,
              segmentCount,
              backgroundType,
              isGradientBackground ? gradientColorStops : solidColorStops
            )}
          </div>
        ) : (
          <div
            className="table-gauge-cell-bar"
            style={{
              width: `${clampedPercentage}%`,
              ...(barGradient && {
                backgroundImage: barGradient,
                backgroundSize: backgroundSize,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '0 0',
              }),
              ...(!barGradient && {
                backgroundColor: solidBarColor,
              }),
            }}
          />
        )}
      </div>
      {options?.isValuesVisible && (
        <div
          title={formattedValue}
          className="table-gauge-cell-value"
          style={{color: textColor}}
        >
          {options?.prefix ?? ''}
          {formattedValue}
          {options?.suffix ?? ''}
        </div>
      )}
    </div>
  )
}

const buildSegments = (
  percentage: number,
  segmentCount: number,
  backgroundType: BackgroundTypeMode,
  colorStops: ColorStop[]
): JSX.Element[] => {
  const safeSegmentCount = Math.max(segmentCount, 1)
  const isGradientBackground = backgroundType === BACKGROUND_TYPE_MODES.GRADIENT

  return Array.from({length: safeSegmentCount}, (_, index) => {
    const segmentPercent = ((index + 1) / safeSegmentCount) * 100
    const isActive = segmentPercent <= percentage
    const color = isGradientBackground
      ? getGradientColorForPercent(segmentPercent, colorStops)
      : getSolidColorForPercent(segmentPercent, colorStops)

    return (
      <div
        key={`segment-${index}`}
        className={`table-gauge-cell-segment${
          isActive ? ' table-gauge-cell-segment--active' : ''
        }`}
        style={{
          backgroundColor: color,
          opacity: isActive ? 1 : 0.2,
          borderColor: isActive ? 'transparent' : color,
        }}
      />
    )
  })
}

export default TableGaugeCell
