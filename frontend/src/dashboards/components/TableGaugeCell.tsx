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

type ValueState = 'valid' | 'null' | 'invalid'

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

  if (width < 520) {
    return 50
  }

  if (width < 820) {
    return 70
  }

  if (width < 1020) {
    return 90
  }

  return 120
}

function TableGaugeCell({options, value}: Props) {
  const gaugeRef = useRef<HTMLDivElement>(null)

  const [valueState, setValueState] = useState<ValueState>('valid')

  const [segmentCount, setSegmentCount] = useState<number>(50)

  const [isZeroRange, setIsZeroRange] = useState<boolean>(false)

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

  useEffect(() => {
    if (value === null) {
      setValueState('null')
    } else if (typeof value !== 'number' || !Number.isFinite(value)) {
      setValueState('invalid')
    } else {
      setValueState('valid')
    }
  }, [value])

  useEffect(() => {
    setIsZeroRange(Number(options?.min) === 0 && Number(options?.max) === 0)
  }, [options?.min, options?.max])

  const parsedValue =
    typeof value === 'number' ? value : !_.isNaN(value) ? Number(value) : NaN
  const numericValue = Number.isFinite(parsedValue) ? parsedValue : null

  const max = options?.max ?? 0

  const min = options?.min ?? 0

  const range = max - min || 1

  const percentage = isZeroRange
    ? null
    : numericValue !== null
    ? ((numericValue - min) / range) * 100
    : 0

  const clampedPercentage = Math.max(0, Math.min(100, percentage))

  const gradientColors: ColorString[] = options?.colors?.length
    ? options.colors
    : DEFAULT_LINE_COLORS

  const validThresholdColors: ColorNumber[] = options?.thresholdColors?.length
    ? options.thresholdColors.filter(color => {
        const value = Number(color.value)
        const minValue = options?.min != null ? Number(options.min) : null
        const maxValue = options?.max != null ? Number(options.max) : null

        if (minValue != null && value < minValue) {
          return false
        }

        if (maxValue != null && value > maxValue) {
          return false
        }

        return true
      })
    : []

  const solidColors: ColorNumber[] = validThresholdColors.length
    ? validThresholdColors
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
    ? getGradientColorForPercent(
        clampedPercentage,
        gradientColorStops,
        isZeroRange
      )
    : getSolidColorForPercent(clampedPercentage, solidColorStops, isZeroRange)

  const backgroundSize =
    barGradient && clampedPercentage > 0
      ? `${(100 / clampedPercentage) * 100}% 100%`
      : undefined

  const chartType = options?.chartType ?? CHART_TYPE_MODES.CONTINUOUS

  const isPercent = options?.isPercent ?? true

  const decimalPlaces = Number.isFinite(options?.decimalPlaces)
    ? Math.max(0, options.decimalPlaces)
    : undefined

  const rawValueForDisplay = isPercent ? clampedPercentage : numericValue

  const valueToDisplay = Number.isFinite(rawValueForDisplay)
    ? rawValueForDisplay
    : null

  const formattedValue = formatDisplayValue(
    valueToDisplay,
    isPercent,
    decimalPlaces,
    options?.valueFormat
  )

  return (
    <div
      className={`table-gauge-cell-container ${
        !options?.isGauge || valueState !== 'valid' ? 'only-value' : ''
      }`}
    >
      {valueState === 'null' ? (
        <div className="table-gauge-cell-value empty-value">--</div>
      ) : valueState === 'invalid' ? (
        <div>{value}</div>
      ) : (
        <>
          {options.isGauge && (
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
                <>
                  <div
                    className="table-gauge-cell-background"
                    style={{
                      ...(barGradient && {
                        backgroundImage: barGradient,
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: '0 0',
                      }),
                      ...(!barGradient && {
                        backgroundColor: solidBarColor,
                      }),
                      opacity: 0.2,
                    }}
                  />
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
                </>
              )}
            </div>
          )}
          {options?.isShowValues && (
            <div
              title={options?.prefix + formattedValue + options?.suffix}
              className={`table-gauge-cell-value ${
                !options?.isGauge ? 'only-value' : ''
              }`}
              style={{color: textColor}}
            >
              {options?.prefix ?? ''}
              {formattedValue}
              {options?.suffix ?? ''}
            </div>
          )}
        </>
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
