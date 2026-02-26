import React, {useMemo, useState} from 'react'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'

type PointValue = number | string | null | undefined

interface TableLineChartCellOptions {
  valueLabel?: 'minimum' | 'maximum' | 'last'
  zeroBaseline?: boolean
  fillArea?: boolean
  showLine?: boolean
  showPoint?: boolean
  connectSeparatedPoints?: boolean
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
  const fillArea = options?.fillArea ?? false
  const zeroBaseline = options?.zeroBaseline ?? false
  const showLine = options?.showLine ?? true
  const showPoint = options?.showPoint ?? false
  const connectSeparatedPoints = options?.connectSeparatedPoints ?? false
  const areaOpacity = options?.areaOpacity ?? 0.15
  const pointRadius = options?.pointRadius ?? Math.max(strokeWidth + 0.5, 2)
  const valueLabel = options?.valueLabel
  const [hoverState, setHoverState] = useState<HoverState | null>(null)

  const validValues = useMemo(
    () => values.map(toFiniteNumber).filter((value): value is number => value !== null),
    [values]
  )

  const normalizedPoints = useMemo(() => {
    if (validValues.length === 0 || values.length === 0) {
      return [] as NormalizedPoint[]
    }

    const min = zeroBaseline
      ? Math.min(0, ...validValues)
      : Math.min(...validValues)
    const max = zeroBaseline
      ? Math.max(0, ...validValues)
      : Math.max(...validValues)
    const range = max - min
    const xStep =
      values.length > 1 ? VIEW_BOX_WIDTH / (values.length - 1) : VIEW_BOX_WIDTH

    return values.reduce<NormalizedPoint[]>((acc, value, index) => {
      const numericValue = toFiniteNumber(value)
      if (numericValue === null) {
        return acc
      }

      const x = xStep * index
      // [ZERO-RANGE HEIGHT BLOCK] data가 모두 같을 때(예: 전부 0) y 높이 처리
      const y =
        range === 0
          ? zeroBaseline
            ? VIEW_BOX_HEIGHT
            : VIEW_BOX_HEIGHT / 2
          : ((max - numericValue) / range) * VIEW_BOX_HEIGHT

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

    if (valueLabel === 'minimum') {
      return 'Min: ' + Math.min(...validValues).toLocaleString()
    }

    if (valueLabel === 'maximum') {
      return 'Max: ' + Math.max(...validValues).toLocaleString()
    }

    for (let index = values.length - 1; index >= 0; index--) {
      const value = values[index]
      const numericValue = toFiniteNumber(value)
      if (numericValue !== null) {
        return numericValue.toLocaleString()
      }
    }

    return null
  }, [valueLabel, validValues, values])

  const isEmpty = segments.length === 0
  const hoverTooltipText = hoverState?.point.value.toLocaleString() ?? null
  const tooltipStyle = hoverState
    ? {
        left: `${Math.min(Math.max((hoverState.point.x / VIEW_BOX_WIDTH) * 100, 8), 92)}%`,
        top: `${Math.min(Math.max((hoverState.point.y / VIEW_BOX_HEIGHT) * 100, 10), 90)}%`,
      }
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
                    r={Math.max(pointRadius + 1.5, 3)}
                  />
                  <circle
                    className="table-line-cell-hover-point"
                    cx={hoverState.point.x}
                    cy={hoverState.point.y}
                    r={Math.max(pointRadius, 2.5)}
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
