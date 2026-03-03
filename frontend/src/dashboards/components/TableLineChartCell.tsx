import React, {useMemo, useState} from 'react'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {formatDisplayValue} from 'src/dashboards/utils/gaugeCell'
import {FormatOption} from 'src/types/statisticalgraph'

type PointValue = number | string | null | undefined

interface TableLineChartCellOptions {
  valueLabel?: 'minimum' | 'maximum' | 'last'
  valueFormat?: FormatOption
  decimalPlaces?: number
  isZeroBaseline?: boolean
  isFillArea?: boolean
  isShowLine?: boolean
  isShowPoint?: boolean
  isConnectSeparatedPoints?: boolean
  areaOpacity?: number
  pointRadius?: number
}

interface Props {
  values: PointValue[]
  color?: string
  strokeWidth?: number
  height?: number
  className?: string
  options?: TableLineChartCellOptions
}

interface NormalizedPoint {
  index: number
  value: number
  x: number
  y: number
}

interface HoverState {
  cursorX: number
  cursorY: number
  point: NormalizedPoint
}

const DEFAULT_HEIGHT = 30
const VIEW_BOX_WIDTH = 100
const VIEW_BOX_HEIGHT = 34
const CHART_TOP_PADDING_RATIO = 0.2
const HOVER_POINT_SIZE_RATIO = 0.5
const TOOLTIP_HORIZONTAL_OFFSET_PERCENT = 6
const TOOLTIP_FLIP_THRESHOLD_PERCENT = 75

const toFiniteNumber = (value: PointValue): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const toPath = (points: NormalizedPoint[]) =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(' ')

function TableLineChartCell({
  values,
  color = DEFAULT_LINE_COLORS[0]?.hex || '#00bfdd',
  strokeWidth = 1,
  height = DEFAULT_HEIGHT,
  className,
  options,
}: Props) {
  const fillArea = options?.isFillArea ?? false
  const zeroBaseline = options?.isZeroBaseline ?? false
  const showLine = options?.isShowLine ?? true
  const showPoint = options?.isShowPoint ?? false
  const connectSeparatedPoints = options?.isConnectSeparatedPoints ?? false
  const areaOpacity = options?.areaOpacity ?? 0.15
  const pointRadius = options?.pointRadius ?? Math.max(strokeWidth + 0.5, 1)
  const valueLabel = options?.valueLabel
  const valueFormat = options?.valueFormat
  const decimalPlaces = Number.isFinite(options?.decimalPlaces)
    ? Math.max(0, options.decimalPlaces)
    : 1
  const [hoverState, setHoverState] = useState<HoverState | null>(null)

  const validValues = useMemo(
    () =>
      values
        .map(toFiniteNumber)
        .filter((value): value is number => value !== null),
    [values]
  )

  const normalizedPoints = useMemo(() => {
    if (validValues.length === 0 || values.length === 0) {
      return [] as NormalizedPoint[]
    }

    let min = zeroBaseline
      ? Math.min(0, ...validValues)
      : Math.min(...validValues)
    let max = zeroBaseline
      ? Math.max(0, ...validValues)
      : Math.max(...validValues)

    if (min === max) {
      const domainSize = Math.max(Math.abs(max), 1)
      if (zeroBaseline) {
        min = Math.min(0, min)
        max = min + domainSize
      } else {
        min -= domainSize / 2
        max += domainSize / 2
      }
    }

    const range = max - min
    const chartTopPadding = VIEW_BOX_HEIGHT * CHART_TOP_PADDING_RATIO
    const drawableHeight = VIEW_BOX_HEIGHT - chartTopPadding
    const xStep =
      values.length > 1 ? VIEW_BOX_WIDTH / (values.length - 1) : VIEW_BOX_WIDTH

    return values.reduce<NormalizedPoint[]>((acc, value, index) => {
      const numericValue = toFiniteNumber(value)
      if (numericValue === null) {
        return acc
      }

      const x = xStep * index
      const y =
        chartTopPadding + ((max - numericValue) / range) * drawableHeight

      acc.push({
        index,
        value: numericValue,
        x,
        y,
      })
      return acc
    }, [])
  }, [values, validValues, zeroBaseline])

  const segments = useMemo(() => {
    if (normalizedPoints.length === 0 || values.length === 0) {
      return []
    }

    if (connectSeparatedPoints) {
      return [normalizedPoints]
    }

    const newSegments: NormalizedPoint[][] = []
    let current: NormalizedPoint[] = []

    values.forEach((_, index) => {
      const point = normalizedPoints.find(item => item.index === index)
      if (point) {
        current.push(point)
      } else if (current.length > 0) {
        newSegments.push(current)
        current = []
      }
    })

    if (current.length > 0) {
      newSegments.push(current)
    }

    return newSegments
  }, [values, normalizedPoints, connectSeparatedPoints])

  // [HOVER INTERACTION BLOCK] 마우스 hover 상태 계산/갱신
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (normalizedPoints.length === 0) {
      return
    }

    const target = event.currentTarget
    const rect = target.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return
    }

    const nextCursorX =
      ((event.clientX - rect.left) / rect.width) * VIEW_BOX_WIDTH
    const nextCursorY =
      ((event.clientY - rect.top) / rect.height) * VIEW_BOX_HEIGHT

    let nearestPoint = normalizedPoints[0]
    let nearestDistance = Math.abs(nearestPoint.x - nextCursorX)

    for (let index = 1; index < normalizedPoints.length; index++) {
      const point = normalizedPoints[index]
      const distance = Math.abs(point.x - nextCursorX)
      if (distance < nearestDistance) {
        nearestPoint = point
        nearestDistance = distance
      }
    }

    setHoverState({
      cursorX: nextCursorX,
      cursorY: nextCursorY,
      point: nearestPoint,
    })
  }

  // [HOVER INTERACTION BLOCK] 마우스 이탈 시 hover 상태 초기화
  const handleMouseLeave = () => {
    setHoverState(null)
  }

  const valueLabelText = useMemo(() => {
    if (!valueLabel || validValues.length === 0) {
      return null
    }

    const formatValue = (value: number) =>
      formatDisplayValue(value, false, decimalPlaces, valueFormat).trim()

    if (valueLabel === 'minimum') {
      return 'Min: ' + formatValue(Math.min(...validValues))
    }

    if (valueLabel === 'maximum') {
      return 'Max: ' + formatValue(Math.max(...validValues))
    }

    for (let index = values.length - 1; index >= 0; index--) {
      const value = values[index]
      const numericValue = toFiniteNumber(value)
      if (numericValue !== null) {
        return 'Last: ' + formatValue(numericValue)
      }
    }

    return null
  }, [valueLabel, validValues, values, decimalPlaces, valueFormat])

  const isEmpty = segments.length === 0
  const hoverTooltipText =
    hoverState?.point.value !== undefined
      ? formatDisplayValue(
          hoverState.point.value,
          false,
          decimalPlaces,
          valueFormat
        ).trim()
      : null
  const tooltipStyle = hoverState
    ? (() => {
        const cursorXPercent = (hoverState.cursorX / VIEW_BOX_WIDTH) * 100
        const cursorYPercent = (hoverState.cursorY / VIEW_BOX_HEIGHT) * 100
        const shouldFlipToLeft = cursorXPercent > TOOLTIP_FLIP_THRESHOLD_PERCENT
        const rawLeft = shouldFlipToLeft
          ? cursorXPercent - TOOLTIP_HORIZONTAL_OFFSET_PERCENT
          : cursorXPercent + TOOLTIP_HORIZONTAL_OFFSET_PERCENT

        return {
          left: `${Math.min(Math.max(rawLeft, 4), 96)}%`,
          top: `${Math.min(Math.max(cursorYPercent, 10), 90)}%`,
          transform: shouldFlipToLeft
            ? 'translate(-100%, -50%)'
            : 'translate(0, -50%)',
        }
      })()
    : undefined

  return (
    <div className={`table-line-cell-container ${className ?? ''}`.trim()}>
      {isEmpty ? (
        <div className="table-line-cell-empty">--</div>
      ) : (
        <>
          <div className="table-line-cell-chart" style={{height}}>
            <svg
              className="table-line-cell-svg"
              viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`}
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {segments.map((segment, index) => (
                <React.Fragment key={`segment-${index}`}>
                  {fillArea && segment.length >= 2 && (
                    <path
                      d={`${toPath(segment)} L ${segment[
                        segment.length - 1
                      ].x.toFixed(2)} ${VIEW_BOX_HEIGHT.toFixed(
                        2
                      )} L ${segment[0].x.toFixed(2)} ${VIEW_BOX_HEIGHT.toFixed(
                        2
                      )} Z`}
                      fill={color}
                      opacity={areaOpacity}
                    />
                  )}

                  {showLine && segment.length >= 2 && (
                    <path
                      d={toPath(segment)}
                      fill="none"
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {showPoint &&
                    segment.map((point, pointIndex) => (
                      <circle
                        key={`point-${index}-${pointIndex}`}
                        cx={point.x}
                        cy={point.y}
                        r={pointRadius}
                        fill={color}
                      />
                    ))}

                  {!showLine && !showPoint && segment.length === 1 && (
                    <circle
                      cx={segment[0].x}
                      cy={segment[0].y}
                      r={pointRadius}
                      fill={color}
                    />
                  )}
                </React.Fragment>
              ))}

              {/* [HOVER RENDER BLOCK] crosshair + hover dot 렌더링 */}
              {hoverState && (
                <>
                  <line
                    className="table-line-cell-crosshair"
                    x1={hoverState.cursorX}
                    y1={0}
                    x2={hoverState.cursorX}
                    y2={VIEW_BOX_HEIGHT}
                  />
                  <line
                    className="table-line-cell-crosshair"
                    x1={0}
                    y1={hoverState.cursorY}
                    x2={VIEW_BOX_WIDTH}
                    y2={hoverState.cursorY}
                  />
                  <circle
                    className="table-line-cell-hover-point-outline"
                    cx={hoverState.point.x}
                    cy={hoverState.point.y}
                    r={Math.max(
                      (pointRadius + 1.5) * HOVER_POINT_SIZE_RATIO,
                      1.5
                    )}
                  />
                  <circle
                    className="table-line-cell-hover-point"
                    cx={hoverState.point.x}
                    cy={hoverState.point.y}
                    r={Math.max(pointRadius * HOVER_POINT_SIZE_RATIO, 1.25)}
                  />
                </>
              )}
            </svg>
            {/* [HOVER RENDER BLOCK] hover tooltip 렌더링 */}
            {hoverState && hoverTooltipText !== null && (
              <div className="table-line-cell-tooltip" style={tooltipStyle}>
                {hoverTooltipText}
              </div>
            )}
          </div>
          {valueLabelText !== null && (
            <div className="table-line-cell-value">{valueLabelText}</div>
          )}
        </>
      )}
    </div>
  )
}

export default TableLineChartCell
