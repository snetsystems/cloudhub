import {flatten} from 'lodash'

import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants'

import {Source, Cell} from 'src/types'
import {Layout, LayoutCell, LayoutQuery} from 'src/types/hosts'
import {CellType, CellQuery} from 'src/types/dashboards'

const CELL_WIDTH = 32
const WIDE_CELL_WIDTH = 48
const CELL_HEIGHT = 24
const EXPANDED_CELL_HEIGHT = 32
const PAGE_WIDTH = 96

interface queryWithWhereGroupby {
  wheres?: string
  groupbys?: string
}

export function getCellsWithWhere(
  layouts: Layout[],
  source: Source,
  whereTag: string,
  interval?: number,
  isUsingWideCell?: boolean
): Cell[] {
  const layoutCells = getLayoutCells(layouts, isUsingWideCell)
  const cells = layoutCells.map(d => toCell(d, source, whereTag, interval))

  return cells
}

function getLayoutCells(
  layouts: Layout[],
  isUsingWideCell?: boolean
): LayoutCell[] {
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
    autoPositionCells(autoflowCells, isUsingWideCell),
    ...staticLayouts.map(layout => layout.cells),
  ]

  const cells = translateCellGroups(cellGroups)

  return cells
}

function autoPositionCells(
  cells: LayoutCell[],
  isUsingWideCell?: boolean
): LayoutCell[] {
  const cellWidth = isUsingWideCell ? WIDE_CELL_WIDTH : CELL_WIDTH
  const cellHeight = isUsingWideCell ? EXPANDED_CELL_HEIGHT : CELL_HEIGHT

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
    colors: [],
  }

  return cell
}

function toCellQuery(
  layoutQuery: LayoutQuery & queryWithWhereGroupby,
  source: Source,
  whereTag: string,
  interval?: number
): CellQuery {
  const filteredQuery = {
    ...layoutQuery,
    wheres: [
      ...(layoutQuery.wheres ?? []),
      whereTag ? `"agent_host" = '${whereTag}'` : null,
    ].filter(i => !!i),
    groupbys: [
      ...layoutQuery.groupbys,
      interval > 0 ? `time(${interval}m)` : null,
    ].filter(i => !!i),
  }

  const cellQuery: any =
    !!whereTag || interval > 0
      ? {
          ...filteredQuery,
          source: source.url,
          type: 'influxql',
        }
      : {...layoutQuery, source: source.url, type: 'influxql'}

  return cellQuery
}
