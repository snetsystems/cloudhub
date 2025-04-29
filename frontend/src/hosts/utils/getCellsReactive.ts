import {flatten} from 'lodash'

import {
  DEFAULT_DECIMAL_PLACES,
  NEW_DEFAULT_DASHBOARD_CELL,
} from 'src/dashboards/constants'

import {Source, Cell} from 'src/types'
import {Layout, LayoutCell, LayoutQuery} from 'src/types/hosts'
import {CellType, CellQuery} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'

const PAGE_WIDTH = 96

interface queryWithWhereGroupby {
  wheres?: string
  groupbys?: string
}

interface Ratio {
  xNum: number
  yNum: number
  height: number
}
export function getCellsReactive(
  layouts: Layout[],
  source: Source,
  whereTag: string,
  ratio: Ratio,
  interval?: number
): Cell[] {
  const layoutCells = getLayoutCells(layouts, ratio)
  const cells = layoutCells.map(d => toCell(d, source, whereTag, interval))

  return cells
}

function getLayoutCells(layouts: Layout[], ratio: Ratio): LayoutCell[] {
  if (layouts.length === 0) {
    return []
  }

  const autoflowLayouts = layouts.filter(l => (l.autoflow = true))
  // const autoflowCells = flatten(autoflowLayouts.map(l => l.cells))

  const autoflowCells = flatten(
    autoflowLayouts.map(l =>
      l.cells.map(c => {
        return {...c, measurement: l.measurement}
      })
    )
  )

  const staticLayouts = layouts.filter(layout => !layout.autoflow)
  const cellGroups = [
    autoPositionCells(autoflowCells, ratio),
    ...staticLayouts.map(layout => layout.cells),
  ]
  const cells = translateCellGroups(cellGroups)

  return cells
}

function autoPositionCells(cells: LayoutCell[], ratio: Ratio): LayoutCell[] {
  const cellWidth = PAGE_WIDTH / ratio.xNum
  // const extraHeight = ratio.yNum % 2 == 0 ? 4 : 3
  const extraHeight = 8
  const cellHeight = Math.floor((ratio.height * 2 - extraHeight) / ratio.yNum)

  return cells.reduce((acc, cell, i) => {
    const x = (i * cellWidth) % PAGE_WIDTH
    const y = Math.floor((i * cellWidth) / PAGE_WIDTH) * cellHeight
    const newCell = {...cell, w: cellWidth, h: cellHeight, x, y}

    return [...acc, newCell]
  }, [])
}

function translateCellGroups(groups: LayoutCell[][]): LayoutCell[] {
  const cells = []

  let translateY = 0

  for (const group of groups) {
    let maxY = 0

    for (const cell of group) {
      cell.y += translateY

      if (cell.y > translateY) {
        maxY = cell.y
      }

      cells.push(cell)
    }

    translateY = maxY
  }

  return cells
}

function toCell(
  layoutCell: LayoutCell,
  source: Source,
  whereTag: string,
  interval?: number
): Cell {
  const queries = layoutCell.queries.map(d =>
    toCellQuery(d, source, whereTag, interval)
  )
  const cell = {
    ...NEW_DEFAULT_DASHBOARD_CELL,
    ...layoutCell,
    queries,

    links: {},
    legend: {},
    type: (layoutCell?.type as CellType) || CellType.Line,
    colors: ((layoutCell?.colors as unknown) as ColorString[]) || [],
    decimalPlaces: layoutCell.decimalPlaces || DEFAULT_DECIMAL_PLACES,
  }

  return cell
}

function toCellQuery(
  layoutQuery: LayoutQuery & queryWithWhereGroupby,
  source: Source,
  whereTag: string,
  interval?: number
): CellQuery {
  const additionalWheres = [
    whereTag !== '' ? `"host" = '${whereTag}'` : null,
  ].filter(i => !!i)

  const filteredQuery = {
    ...layoutQuery,
    wheres: [...(layoutQuery.wheres ?? []), ...additionalWheres],
    groupbys: [
      ...(layoutQuery.groupbys ?? []),
      interval && interval > 0 ? `time(${interval}m)` : null,
    ].filter(i => !!i),
  }

  const cellQuery: any =
    whereTag !== '' || (interval && interval > 0)
      ? {
          ...filteredQuery,
          source: source.url,
          type: 'influxql',
        }
      : {...layoutQuery, source: source.url, type: 'influxql'}

  return cellQuery
}
