import {flatten} from 'lodash'

import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants'

import {Source, Cell} from 'src/types'
import {Layout, LayoutCell, LayoutQuery} from 'src/types/hosts'
import {CellType, CellQuery} from 'src/types/dashboards'

const CELL_WIDTH = 32
const CELL_HEIGHT = 24
const PAGE_WIDTH = 96

interface queryWithWhereGroupby {
  wheres?: string
  groupbys?: string
}

export function getCellsWithWhere(
  layouts: Layout[],
  source: Source,
  whereTag: string,
  isAnnotation?: boolean,
  interval?: number
): Cell[] {
  const layoutCells = getLayoutCells(layouts)
  const cells = layoutCells.map(d =>
    toCell(d, source, whereTag, isAnnotation, interval)
  )

  return cells
}

function getLayoutCells(layouts: Layout[]): LayoutCell[] {
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
    autoPositionCells(autoflowCells),
    ...staticLayouts.map(layout => layout.cells),
  ]

  const cells = translateCellGroups(cellGroups)

  return cells
}

function autoPositionCells(cells: LayoutCell[]): LayoutCell[] {
  return cells.reduce((acc, cell, i) => {
    const x = (i * CELL_WIDTH) % PAGE_WIDTH
    const y = Math.floor((i * CELL_WIDTH) / PAGE_WIDTH) * CELL_HEIGHT
    const newCell = {...cell, w: CELL_WIDTH, h: CELL_HEIGHT, x, y}

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
  isAnnotation?: boolean,
  interval?: number
): Cell {
  const queries = layoutCell.queries.map(d =>
    toCellQuery(d, source, whereTag, isAnnotation, interval)
  )
  const cell = {
    ...NEW_DEFAULT_DASHBOARD_CELL,
    ...layoutCell,
    queries,

    links: {},
    legend: {},
    type: CellType.Line,
    colors: [],
  }

  return cell
}

function toCellQuery(
  layoutQuery: LayoutQuery & queryWithWhereGroupby,
  source: Source,
  whereTag: string,
  isAnnotation?: boolean,
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
      isAnnotation ? (interval > 0 ? `time(${interval}m)` : `time(1m)`) : null,
    ].filter(i => !!i),
  }

  const cellQuery: any =
    !!whereTag || isAnnotation
      ? {
          ...filteredQuery,
          source: source.url,
          type: 'influxql',
        }
      : {...layoutQuery, source: source.url, type: 'influxql'}

  return cellQuery
}
