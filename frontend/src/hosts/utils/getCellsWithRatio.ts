import {flatten} from 'lodash'

import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants'

import {Source, Cell} from 'src/types'
import {Layout, LayoutCell, LayoutQuery} from 'src/types/hosts'
import {CellType, CellQuery} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'

// 추후 높이 조절을 위해 남겨둠 (delete)
const CELL_WIDTH = 32
const WIDE_CELL_WIDTH = 48
const CELL_HEIGHT = 24
const EXPANDED_CELL_HEIGHT = 32
const PAGE_WIDTH = 96

interface queryWithWhereGroupby {
  wheres?: string
  groupbys?: string
}

export function getCellsWithRatio(
  layouts: Layout[],
  source: Source,
  whereTag: {host: string; index: number},
  xNum: number,
  interval?: number
): Cell[] {
  const layoutCells = getLayoutCells(layouts, xNum)
  const cells = layoutCells.map(d => toCell(d, source, whereTag, interval))

  return cells
}

function getLayoutCells(layouts: Layout[], xNum: number): LayoutCell[] {
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
    autoPositionCells(autoflowCells, xNum),
    ...staticLayouts.map(layout => layout.cells),
  ]

  const cells = translateCellGroups(cellGroups)

  return cells
}

function autoPositionCells(cells: LayoutCell[], xNum: number): LayoutCell[] {
  const cellWidth = PAGE_WIDTH / xNum
  const cellHeight = CELL_HEIGHT

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
  whereTag: {host: string; index: number},
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
  }

  return cell
}

function toCellQuery(
  layoutQuery: LayoutQuery & queryWithWhereGroupby,
  source: Source,
  whereTag: {host: string; index: number},
  interval?: number
): CellQuery {
  const additionalWheres = [
    whereTag.host !== '' ? `"host" = '${whereTag.host}'` : null,
    whereTag.index !== -1 ? `"index" = '${whereTag.index}'` : null,
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
    whereTag.host !== '' || whereTag.index !== -1 || (interval && interval > 0)
      ? {
          ...filteredQuery,
          source: source.url,
          type: 'influxql',
        }
      : {...layoutQuery, source: source.url, type: 'influxql'}

  return cellQuery
}
