import moment from 'moment'
import React, {useMemo, useState} from 'react'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {formatDisplayValue} from 'src/dashboards/utils/gaugeCell'
import {
  normalizeTableHoverTime,
  useTableChartCell,
  useTableChartHover,
} from 'src/device_management/components/TableChartHoverContext'
import {TableLineChartPoint, TimeSeriesValue} from 'src/types/series'
import {FormatOption} from 'src/types/statisticalgraph'

type PointValue = number | string | null | undefined
type LineValue = PointValue | TableLineChartPoint

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
  values: LineValue[]
  color?: string
  strokeWidth?: number
  height?: number
  className?: string
  options?: TableLineChartCellOptions
}

interface NormalizedPoint {
  index: number
  time: TimeSeriesValue
  timeKey: string | null
  value: number | null
  displayValue: number | null
  x: number
  y: number | null
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

const isTableLineChartPoint = (
  value: LineValue
): value is TableLineChartPoint =>
  !!value && typeof value === 'object' && 'time' in value && 'value' in value

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
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${(
          point.y ?? 0
        ).toFixed(2)}`
    )
    .join(' ')

const formatHoverTime = (time: TimeSeriesValue): string => {
  if (typeof time === 'number') {
    const parsed = moment.utc(time)
    return parsed.isValid()
      ? parsed.format('YYYY-MM-DD HH:mm:ss')
      : String(time)
  }

  if (typeof time === 'string') {
    const parsed = moment.utc(time)
    return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : time
  }

  return '--'
}

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
  const hoverContext = useTableChartHover()
  const tableCell = useTableChartCell()
  const decimalPlaces = Number.isFinite(options?.decimalPlaces)
    ? Math.max(0, options.decimalPlaces)
    : 1
  const [hoverState, setHoverState] = useState<HoverState | null>(null)
  const cellId = tableCell?.cellId ?? null
  const isSharedHoverEnabled = hoverContext.enabled && !!cellId

  const linePoints = useMemo(
    () =>
      values.map((item, index) => {
        if (isTableLineChartPoint(item)) {
          return {
            index,
            time: item.time ?? index,
            value: toFiniteNumber(item.value),
          }
        }

        return {
          index,
          time: index,
          value: toFiniteNumber(item),
        }
      }),
    [values]
  )

  const hasRawValue = useMemo(
    () => linePoints.some(point => point.value !== null),
    [linePoints]
  )

  const displayValues = useMemo(
    () =>
      linePoints.map(point =>
        point.value !== null ? point.value : hasRawValue ? 0 : null
      ),
    [linePoints, hasRawValue]
  )

  const validValues = useMemo(
    () => displayValues.filter((value): value is number => value !== null),
    [displayValues]
  )

  const normalizedPoints = useMemo(() => {
    if (linePoints.length === 0) {
      return [] as NormalizedPoint[]
    }

    let min = 0
    let max = 1
    let range = 1
    const hasDrawableValue = validValues.length > 0

    if (hasDrawableValue) {
      min = zeroBaseline
        ? Math.min(0, ...validValues)
        : Math.min(...validValues)
      max = zeroBaseline
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

      range = max - min
    }

    const chartTopPadding = VIEW_BOX_HEIGHT * CHART_TOP_PADDING_RATIO
    const drawableHeight = VIEW_BOX_HEIGHT - chartTopPadding
    const xStep =
      linePoints.length > 1
        ? VIEW_BOX_WIDTH / (linePoints.length - 1)
        : VIEW_BOX_WIDTH / 2

    return linePoints.map((point, index) => {
      const x = linePoints.length > 1 ? xStep * index : VIEW_BOX_WIDTH / 2
      const displayValue = displayValues[index] ?? null

      return {
        index,
        time: point.time,
        timeKey: normalizeTableHoverTime(point.time),
        value: point.value,
        displayValue,
        x,
        y:
          displayValue === null || !hasDrawableValue
            ? null
            : chartTopPadding + ((max - displayValue) / range) * drawableHeight,
      }
    })
  }, [linePoints, displayValues, validValues, zeroBaseline])

  const drawablePoints = useMemo(
    () =>
      normalizedPoints.filter(
        (point): point is NormalizedPoint & {value: number; y: number} =>
          point.value !== null && point.y !== null
      ),
    [normalizedPoints]
  )

  const segments = useMemo(() => {
    if (drawablePoints.length === 0 || linePoints.length === 0) {
      return []
    }

    if (connectSeparatedPoints) {
      return [drawablePoints]
    }

    const newSegments: NormalizedPoint[][] = []
    let current: NormalizedPoint[] = []

    normalizedPoints.forEach(point => {
      if (point.y !== null) {
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
  }, [linePoints, normalizedPoints, drawablePoints, connectSeparatedPoints])

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

    if (isSharedHoverEnabled && cellId) {
      hoverContext.setHover({
        cellId,
        time: nearestPoint.time,
        cursorX: nextCursorX,
        cursorY: nextCursorY,
      })
      return
    }

    setHoverState({
      cursorX: nextCursorX,
      cursorY: nextCursorY,
      point: nearestPoint,
    })
  }

  const handleMouseLeave = () => {
    if (isSharedHoverEnabled && cellId) {
      hoverContext.clearHover(cellId)
      return
    }

    setHoverState(null)
  }

  const resolvedHoverState = useMemo(() => {
    if (isSharedHoverEnabled) {
      if (!hoverContext.hoveredTimeKey) {
        return null
      }

      const point = normalizedPoints.find(
        item => item.timeKey === hoverContext.hoveredTimeKey
      )
      if (!point) {
        return null
      }

      return {
        cursorX: hoverContext.cursorX,
        cursorY: hoverContext.cursorY,
        point,
        isActive: hoverContext.activeCellId === cellId,
      }
    }

    if (!hoverState) {
      return null
    }

    return {
      ...hoverState,
      isActive: true,
    }
  }, [isSharedHoverEnabled, hoverContext, normalizedPoints, hoverState, cellId])

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
      const numericValue = linePoints[index]?.value ?? null
      if (numericValue !== null) {
        return 'Last: ' + formatValue(numericValue)
      }
    }

    return null
  }, [
    valueLabel,
    validValues,
    linePoints,
    values.length,
    decimalPlaces,
    valueFormat,
  ])

  const isEmpty = !hasRawValue
  const hoverTooltipText =
    resolvedHoverState?.point.value !== undefined
      ? formatDisplayValue(
          resolvedHoverState.point.value,
          false,
          decimalPlaces,
          valueFormat
        ).trim()
      : null
  const hoverTooltipTimeText = resolvedHoverState
    ? formatHoverTime(resolvedHoverState.point.time)
    : null
  const tooltipStyle = resolvedHoverState
    ? (() => {
        const cursorXPercent =
          (resolvedHoverState.cursorX / VIEW_BOX_WIDTH) * 100
        const cursorYPercent =
          (resolvedHoverState.cursorY / VIEW_BOX_HEIGHT) * 100
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
          <div className="table-line-cell-tooltip-layer" style={{height}}>
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
                        )} L ${segment[0].x.toFixed(
                          2
                        )} ${VIEW_BOX_HEIGHT.toFixed(2)} Z`}
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

                    {!showPoint && segment.length === 1 && (
                      <circle
                        className="table-line-cell-single-point"
                        cx={segment[0].x}
                        cy={segment[0].y}
                        r={pointRadius}
                        fill={color}
                      />
                    )}
                  </React.Fragment>
                ))}

                {resolvedHoverState && (
                  <>
                    <line
                      className="table-line-cell-crosshair table-line-cell-crosshair--vertical"
                      x1={resolvedHoverState.point.x}
                      y1={0}
                      x2={resolvedHoverState.point.x}
                      y2={VIEW_BOX_HEIGHT}
                    />
                    {resolvedHoverState.isActive &&
                      resolvedHoverState.point.value !== null &&
                      resolvedHoverState.point.y !== null && (
                        <>
                          <line
                            className="table-line-cell-crosshair table-line-cell-crosshair--horizontal"
                            x1={0}
                            y1={resolvedHoverState.point.y}
                            x2={VIEW_BOX_WIDTH}
                            y2={resolvedHoverState.point.y}
                          />
                          <circle
                            className="table-line-cell-hover-point-outline"
                            cx={resolvedHoverState.point.x}
                            cy={resolvedHoverState.point.y}
                            r={Math.max(
                              (pointRadius + 1.5) * HOVER_POINT_SIZE_RATIO,
                              1.5
                            )}
                          />
                          <circle
                            className="table-line-cell-hover-point"
                            cx={resolvedHoverState.point.x}
                            cy={resolvedHoverState.point.y}
                            r={Math.max(
                              pointRadius * HOVER_POINT_SIZE_RATIO,
                              1.25
                            )}
                          />
                        </>
                      )}
                  </>
                )}
              </svg>
            </div>
            {resolvedHoverState?.isActive &&
              hoverTooltipText !== null &&
              hoverTooltipTimeText !== null && (
                <div className="table-line-cell-tooltip" style={tooltipStyle}>
                  <div className="table-line-cell-tooltip-time">
                    {hoverTooltipTimeText}
                  </div>
                  <div className="table-line-cell-tooltip-value">
                    {hoverTooltipText}
                  </div>
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
