import classnames from 'classnames'
import moment from 'moment'
import React, {useMemo, useState} from 'react'
import {useSelector} from 'react-redux'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {formatDisplayValue} from 'src/dashboards/utils/gaugeCell'
import {
  normalizeTableHoverTime,
  useTableChartCell,
  useTableChartHover,
} from 'src/device_management/components/TableChartHoverContext'
import {TableLineChartPoint, TimeSeriesValue} from 'src/types/series'
import {TimeZones} from 'src/types'
import {FormatOption} from 'src/types/statisticalgraph'

type PointValue = number | string | null | undefined
type LineValue = PointValue | TableLineChartPoint
type ValueLabelOption =
  | 'minimum'
  | 'maximum'
  | 'last'
  | 'average'
  | 'min'
  | 'max'
  | 'avr'

interface TableLineChartCellOptions {
  /** 텍스트 라벨로 표시할 값의 종류 (예: 최소, 최대, 평균, 마지막 값 등) */
  valueLabel?: ValueLabelOption | ValueLabelOption[]
  /** 값을 포맷팅할 형식 지정 (예: 단위 표시 등) */
  valueFormat?: FormatOption
  /** 숫자 표시 시 소수점 이하 자릿수 */
  decimalPlaces?: number
  /** true이면 차트의 Y축 최소값을 항상 0으로 고정 */
  isZeroBaseline?: boolean
  /** true이면 라인 차트 아래 면적(Area)에 색상을 채움 */
  isFillArea?: boolean
  /** true이면 데이터 포인트를 잇는 선(Line)을 표시 */
  isShowLine?: boolean
  /** true이면 각 데이터 포인트마다 마커(점)를 표시 */
  isShowPoint?: boolean
  /** true이면 중간에 값이 비어있는(null) 구간을 무시하고 선을 연결 */
  isConnectSeparatedPoints?: boolean
  /** 면적(Area) 채우기 시 적용할 투명도 (0.0 ~ 1.0) */
  areaOpacity?: number
  /** 데이터 포인트 마커(점)의 반지름 크기 */
  pointRadius?: number
  /** 렌더링된 값 뒤에 붙일 텍스트 단위 (예: '%', 'MB' 등) */
  suffix?: string
  /** valueLabel 옆에 추가로 표시할 외부 포맷 텍스트 (예: 실 사용량) */
  extraLabel?: string
}

interface Props {
  values: LineValue[]
  /**
   * Anchors the x axis to a wall-clock window `[from, to]` in epoch ms instead
   * of spreading the points evenly across the width. Use it where the window
   * slides faster than the data arrives, so the line visibly moves between
   * samples; omit it to keep the even spacing every other caller relies on.
   */
  xDomain?: [number, number]
  color?: string
  strokeWidth?: number
  height?: number
  className?: string
  options?: TableLineChartCellOptions
  /** Opens detail views etc.; chart area is keyboard-focusable when set */
  onChartClick?: () => void
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

const formatHoverTime = (
  time: TimeSeriesValue,
  timeZone: TimeZones
): string => {
  if (time === null || time === undefined) {
    return '--'
  }

  if (typeof time === 'number') {
    const parsed = timeZone === TimeZones.UTC ? moment.utc(time) : moment(time)
    return parsed.isValid()
      ? parsed.format('YYYY-MM-DD HH:mm:ss')
      : String(time)
  }

  if (typeof time === 'string') {
    const parsed = timeZone === TimeZones.UTC ? moment.utc(time) : moment(time)
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
  onChartClick,
  xDomain,
}: Props) {
  const timeZone = useSelector(
    (state: {app?: {persisted?: {timeZone?: TimeZones}}}) =>
      state.app?.persisted?.timeZone ?? TimeZones.Local
  )

  const fillArea = options?.isFillArea ?? false
  const zeroBaseline = options?.isZeroBaseline ?? false
  const showLine = options?.isShowLine ?? true
  const showPoint = options?.isShowPoint ?? false
  const connectSeparatedPoints = options?.isConnectSeparatedPoints ?? false
  const areaOpacity = options?.areaOpacity ?? 0.15
  const pointRadius = options?.pointRadius ?? Math.max(strokeWidth + 0.5, 1)
  const valueLabel = options?.valueLabel
  const valueFormat = options?.valueFormat
  const suffix = options?.suffix ?? ''
  const extraLabel = options?.extraLabel ?? null
  const reserveEmptyValueRowSpace =
    (!!valueLabel &&
      (Array.isArray(valueLabel) ? valueLabel.length > 0 : true)) ||
    extraLabel !== null
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

    const domainSpan = xDomain ? xDomain[1] - xDomain[0] : 0

    return linePoints.map((point, index) => {
      const evenX = linePoints.length > 1 ? xStep * index : VIEW_BOX_WIDTH / 2
      const x =
        domainSpan > 0 && typeof point.time === 'number'
          ? ((point.time - xDomain[0]) / domainSpan) * VIEW_BOX_WIDTH
          : evenX
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
  }, [linePoints, displayValues, validValues, zeroBaseline, xDomain])

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

    const validPoints = normalizedPoints.filter(p => p.value !== null)
    const searchTargetPoints =
      validPoints.length > 0 ? validPoints : normalizedPoints

    let nearestPoint = searchTargetPoints[0]
    let nearestDistance = Math.abs(nearestPoint.x - nextCursorX)

    for (let index = 1; index < searchTargetPoints.length; index++) {
      const point = searchTargetPoints[index]
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

    const valueLabels = Array.isArray(valueLabel) ? valueLabel : [valueLabel]
    const formatValue = (value: number) =>
      `${formatDisplayValue(
        value,
        false,
        decimalPlaces,
        valueFormat
      ).trim()}${suffix}`

    const lastValue = (() => {
      for (let index = values.length - 1; index >= 0; index--) {
        const numericValue = linePoints[index]?.value ?? null
        if (numericValue !== null) {
          return numericValue
        }
      }

      return null
    })()

    const labelNodes = valueLabels
      .map((label, index) => {
        if (label === 'minimum' || label === 'min') {
          return (
            <React.Fragment key={index}>
              <strong>Min:</strong> {formatValue(Math.min(...validValues))}
            </React.Fragment>
          )
        }

        if (label === 'maximum' || label === 'max') {
          return (
            <React.Fragment key={index}>
              <strong>Max:</strong> {formatValue(Math.max(...validValues))}
            </React.Fragment>
          )
        }

        if (label === 'average' || label === 'avr') {
          const average =
            validValues.reduce((sum, current) => sum + current, 0) /
            validValues.length
          return (
            <React.Fragment key={index}>
              <strong>Avg:</strong> {formatValue(average)}
            </React.Fragment>
          )
        }

        if (label === 'last' && lastValue !== null) {
          return (
            <React.Fragment key={index}>
              <strong>Last:</strong> {formatValue(lastValue)}
            </React.Fragment>
          )
        }

        return null
      })
      .filter(node => node !== null)

    if (labelNodes.length === 0) {
      return null
    }

    return labelNodes.map((node, index) => (
      <React.Fragment key={`val-${index}`}>
        {index > 0 && <span style={{margin: '0 4px'}}>|</span>}
        {node}
      </React.Fragment>
    ))
  }, [
    valueLabel,
    validValues,
    linePoints,
    values.length,
    decimalPlaces,
    valueFormat,
    suffix,
  ])

  const handleChartActivate = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (!onChartClick) return
    e.stopPropagation()
    if ('key' in e) {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
    }
    onChartClick()
  }

  const isEmpty = !hasRawValue
  const hoverTooltipText =
    resolvedHoverState?.point.value !== undefined
      ? `${formatDisplayValue(
          resolvedHoverState.point.value,
          false,
          decimalPlaces,
          valueFormat
        ).trim()}${suffix}`
      : null
  const hoverTooltipTimeText = resolvedHoverState
    ? formatHoverTime(resolvedHoverState.point.time, timeZone)
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
        <>
          <div className="table-line-cell-tooltip-layer" style={{height}}>
            <div
              className="table-line-cell-chart table-line-cell-chart--empty"
              style={{height}}
            >
              <span className="table-line-cell-empty table-line-cell-empty--in-chart">
                --
              </span>
            </div>
          </div>
          {reserveEmptyValueRowSpace && (
            <div
              className="table-line-cell-value table-line-cell-value--empty-placeholder"
              aria-hidden
            />
          )}
        </>
      ) : (
        <>
          <div className="table-line-cell-tooltip-layer" style={{height}}>
            <div
              className={classnames('table-line-cell-chart', {
                'table-line-cell-chart--clickable': !!onChartClick,
              })}
              style={{height}}
              onClick={onChartClick ? handleChartActivate : undefined}
              onKeyDown={onChartClick ? handleChartActivate : undefined}
              role={onChartClick ? 'button' : undefined}
              tabIndex={onChartClick ? 0 : undefined}
            >
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
                        vectorEffect="non-scaling-stroke"
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
              </svg>
              {resolvedHoverState && (
                <svg
                  className="table-line-cell-svg-hover-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  <line
                    className="table-line-cell-crosshair table-line-cell-crosshair--vertical"
                    x1={`${
                      (resolvedHoverState.point.x / VIEW_BOX_WIDTH) * 100
                    }%`}
                    y1="0"
                    x2={`${
                      (resolvedHoverState.point.x / VIEW_BOX_WIDTH) * 100
                    }%`}
                    y2="100%"
                  />
                  {resolvedHoverState.isActive &&
                    resolvedHoverState.point.value !== null &&
                    resolvedHoverState.point.y !== null && (
                      <>
                        <line
                          className="table-line-cell-crosshair table-line-cell-crosshair--horizontal"
                          x1="0"
                          y1={`${
                            (resolvedHoverState.point.y / VIEW_BOX_HEIGHT) * 100
                          }%`}
                          x2="100%"
                          y2={`${
                            (resolvedHoverState.point.y / VIEW_BOX_HEIGHT) * 100
                          }%`}
                        />
                        <circle
                          className="table-line-cell-hover-point-outline"
                          cx={`${
                            (resolvedHoverState.point.x / VIEW_BOX_WIDTH) * 100
                          }%`}
                          cy={`${
                            (resolvedHoverState.point.y / VIEW_BOX_HEIGHT) * 100
                          }%`}
                          r={Math.max(
                            (pointRadius + 1.5) * HOVER_POINT_SIZE_RATIO,
                            1.5
                          )}
                        />
                        <circle
                          className="table-line-cell-hover-point"
                          cx={`${
                            (resolvedHoverState.point.x / VIEW_BOX_WIDTH) * 100
                          }%`}
                          cy={`${
                            (resolvedHoverState.point.y / VIEW_BOX_HEIGHT) * 100
                          }%`}
                          r={Math.max(
                            pointRadius * HOVER_POINT_SIZE_RATIO,
                            1.25
                          )}
                        />
                      </>
                    )}
                </svg>
              )}
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
          {(valueLabelText !== null || extraLabel !== null) && (
            <div className="table-line-cell-value">
              {valueLabelText}
              {extraLabel !== null && (
                <span className="table-line-cell-value-extra">
                  {valueLabelText ? ' (' : ''}
                  {extraLabel}
                  {valueLabelText ? ')' : ''}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default TableLineChartCell
