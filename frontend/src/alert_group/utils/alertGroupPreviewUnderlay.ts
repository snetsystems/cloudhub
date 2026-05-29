/* eslint-disable no-undef */
import {AlertCondition, AlertConditionOperator} from 'src/types'
import {RuleValues, DygraphClass} from 'src/types'
import {
  EQUAL_TO,
  EQUAL_TO_OR_GREATER_THAN,
  EQUAL_TO_OR_LESS_THAN,
  GREATER_THAN,
  LESS_THAN,
  NOT_EQUAL_TO,
} from 'src/kapacitor/constants'

type DygraphArea = {x: number; y: number; w: number; h: number}

const CRITICAL_FILL = 'rgba(241, 85, 99, 0.32)'
const WARNING_FILL = 'rgba(255, 185, 74, 0.28)'
const INFO_FILL = 'rgba(34, 173, 246, 0.26)'
const DEFAULT_FILL = 'rgba(78, 216, 160, 0.28)'

function levelFill(level: string): string {
  if (level === 'critical') {
    return CRITICAL_FILL
  }
  if (level === 'warning') {
    return WARNING_FILL
  }
  if (level === 'info') {
    return INFO_FILL
  }
  return DEFAULT_FILL
}

export function conditionOperatorToRuleValuesOperator(
  t: AlertConditionOperator | undefined
): string {
  switch (t) {
    case 'greater':
      return GREATER_THAN
    case 'greater_equal':
      return EQUAL_TO_OR_GREATER_THAN
    case 'less':
      return LESS_THAN
    case 'less_equal':
      return EQUAL_TO_OR_LESS_THAN
    case 'equal':
      return EQUAL_TO
    case 'not_equal':
      return NOT_EQUAL_TO
    default:
      return GREATER_THAN
  }
}

export function buildAlertGroupPreviewRuleValues(
  conditions: AlertCondition[]
): RuleValues | null {
  const enabled = conditions.filter(
    c => c.enabled && c.value !== '' && isFinite(Number(c.value))
  )
  if (enabled.length === 0) {
    return null
  }
  const maxCond = enabled[0]
  const op = maxCond.operator || 'greater'
  const nums = enabled.map(c => Number(c.value))
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  return {
    operator: conditionOperatorToRuleValuesOperator(op as any),
    value: String(max),
    rangeValue: nums.length > 1 ? String(min) : '',
  }
}

interface ThresholdItem {
  level: string
  value: number
}

function parseThresholdItems(conditions: AlertCondition[]): ThresholdItem[] {
  return conditions
    .filter(c => c.enabled && c.value !== '' && isFinite(Number(c.value)))
    .map(c => ({level: c.level, value: Number(c.value)}))
}

function fillYRange(
  canvas: CanvasRenderingContext2D,
  dygraph: DygraphClass,
  area: DygraphArea,
  dataY1: number,
  dataY2: number,
  fill: string
): void {
  const dom1 = dygraph.toDomYCoord(dataY1)
  const dom2 = dygraph.toDomYCoord(dataY2)
  const top = Math.min(dom1, dom2)
  const bottom = Math.max(dom1, dom2)
  canvas.fillStyle = fill
  canvas.fillRect(area.x, top, area.w, bottom - top)
}

function strokeThresholdLine(
  canvas: CanvasRenderingContext2D,
  dygraph: DygraphClass,
  area: DygraphArea,
  dataY: number
): void {
  const y = dygraph.toDomYCoord(dataY)
  if (y < area.y - 1 || y > area.y + area.h + 1) {
    return
  }
  canvas.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  canvas.lineWidth = 1
  canvas.beginPath()
  canvas.moveTo(area.x, y)
  canvas.lineTo(area.x + area.w, y)
  canvas.stroke()
}

export function buildAlertGroupPreviewUnderlay({
  conditions,
}: {
  conditions: AlertCondition[]
}): (
  canvas: CanvasRenderingContext2D,
  area: DygraphArea,
  dygraph: DygraphClass
) => void {
  return (
    canvas: CanvasRenderingContext2D,
    area: DygraphArea,
    dygraph: DygraphClass
  ) => {
    const items = parseThresholdItems(conditions)
    if (items.length === 0) {
      return
    }

    const [yMin, yMax] = dygraph.yAxisRange()
    const span = Math.max(yMax - yMin, 1e-9)
    const band = span * 0.01

    // We process each condition's threshold item and draw its corresponding background fill
    for (const it of items) {
      const cond = conditions.find(c => c.level === it.level)
      const op = cond?.operator || 'greater'

      switch (op) {
        case 'greater':
        case 'greater_equal': {
          fillYRange(canvas, dygraph, area, it.value, yMax, levelFill(it.level))
          break
        }
        case 'less':
        case 'less_equal': {
          fillYRange(canvas, dygraph, area, yMin, it.value, levelFill(it.level))
          break
        }
        case 'equal': {
          fillYRange(
            canvas,
            dygraph,
            area,
            it.value - band / 2,
            it.value + band / 2,
            levelFill(it.level)
          )
          break
        }
        case 'not_equal': {
          fillYRange(
            canvas,
            dygraph,
            area,
            it.value - band / 2,
            it.value + band / 2,
            levelFill(it.level)
          )
          break
        }
        default: {
          fillYRange(canvas, dygraph, area, it.value, yMax, levelFill(it.level))
        }
      }
    }

    // Draw the white threshold lines on top of the fills
    for (const it of items) {
      strokeThresholdLine(canvas, dygraph, area, it.value)
    }
  }
}
