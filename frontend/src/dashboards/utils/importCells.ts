import {Cell} from 'src/types'
import {ImportStrategy} from 'src/shared/types/importModal'
import {CellOrigin} from 'src/types/dashboards'

const GRID_COLS = 96

function uniqueIdForAppend(existingIds: Set<string>, prefix: string): string {
  let id = `${prefix}-import-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  while (existingIds.has(id)) {
    id = `${prefix}-import-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
  return id
}

/**
 * Append strategy: place imported cells below the current grid so layout is not broken.
 * Uses remaining width on the bottom row first, then fills rows left-to-right; wraps when row exceeds GRID_COLS.
 * Assigns new unique cell ids to avoid key collision with existing cells.
 */
function placeAppendedCellsBelow(
  currentCells: Cell[],
  importedCells: Cell[]
): Cell[] {
  const existingIds = new Set(currentCells.map(c => c.i))
  const bottom =
    currentCells.length === 0
      ? 0
      : Math.max(...currentCells.map(c => (c.y ?? 0) + (c.h ?? 4)))
  const cellsOnBottomRow = currentCells.filter(
    c => (c.y ?? 0) + (c.h ?? 4) === bottom
  )
  const rowY =
    cellsOnBottomRow.length > 0
      ? Math.min(...cellsOnBottomRow.map(c => c.y ?? 0))
      : bottom
  const rightmost =
    cellsOnBottomRow.length > 0
      ? Math.max(...cellsOnBottomRow.map(c => (c.x ?? 0) + (c.w ?? 24)))
      : 0
  let x = rightmost < GRID_COLS ? rightmost : 0
  let y = rightmost < GRID_COLS ? rowY : bottom
  let rowHeight =
    cellsOnBottomRow.length > 0
      ? Math.max(...cellsOnBottomRow.map(c => c.h ?? 4))
      : 0
  return importedCells.map(cell => {
    const w = cell.w ?? 24
    const h = cell.h ?? 4
    if (x + w > GRID_COLS && x > 0) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }
    rowHeight = Math.max(rowHeight, h)
    const newId = uniqueIdForAppend(
      existingIds,
      (cell.i || 'cell').replace(/\s+/g, '-').slice(0, 32)
    )
    existingIds.add(newId)
    const placed = {...cell, i: newId, x, y, w, h}
    x += w
    return placed
  })
}

/**
 * Computes the next cells array after import.
 *
 * ID policy:
 * - Fixed Cell (mergeByCellId): preserve original cell IDs so builtin template ids stay stable.
 * - Dashboard List (append): assign new unique ids to avoid collision with existing cells.
 *
 * mergeByCellId: builtin cells that already exist only get visibility updated; new cells keep template id.
 * append: imported cells are placed below the grid and get new ids via placeAppendedCellsBelow.
 */
export function computeNextCells(
  currentCells: Cell[],
  importedCells: Cell[],
  strategy: ImportStrategy
): {nextCells: Cell[]; mergeMatchedCount: number} {
  if (strategy !== 'mergeByCellId') {
    const appended = placeAppendedCellsBelow(currentCells, importedCells)
    return {
      nextCells: [...currentCells, ...appended],
      mergeMatchedCount: 0,
    }
  }

  const key = (id: string) => (id || '').trim().toLowerCase()
  const nameKey = (name: string) => (name || '').trim().toLowerCase()
  const isBuiltin = (c: Cell) => c.cellOrigin === CellOrigin.Builtin
  const templateMatchedByIndex = new Set<number>()
  const result: Cell[] = []

  for (const existing of currentCells) {
    const idKey = key(existing.i)
    const templateById = importedCells.find(
      (tc, i) =>
        !templateMatchedByIndex.has(i) && key(tc.i) === idKey
    )
    if (templateById != null) {
      const idx = importedCells.indexOf(templateById)
      templateMatchedByIndex.add(idx)
      if (isBuiltin(existing)) {
        result.push({...existing, hidden: false})
      } else {
        result.push({...existing, queries: templateById.queries, hidden: false})
      }
      continue
    }
    const existingName = nameKey(existing.name)
    const templateByName = importedCells.find(
      (tc, i) =>
        !templateMatchedByIndex.has(i) &&
        nameKey(tc.name) === existingName
    )
    if (templateByName != null) {
      const idx = importedCells.indexOf(templateByName)
      templateMatchedByIndex.add(idx)
      if (isBuiltin(existing)) {
        result.push({...existing, hidden: false})
      } else {
        result.push({...existing, queries: templateByName.queries, hidden: false})
      }
      continue
    }
    result.push(existing)
  }

  importedCells.forEach((cell, i) => {
    if (templateMatchedByIndex.has(i)) return
    const idK = key(cell.i)
    const existingResultIndex = result.findIndex(c => key(c.i) === idK)
    if (existingResultIndex !== -1) {
      const existingCell = result[existingResultIndex]
      if (isBuiltin(existingCell)) {
        result[existingResultIndex] = {...existingCell, hidden: false}
      } else {
        result[existingResultIndex] = {
          ...existingCell,
          queries: cell.queries,
          name: cell.name,
          hidden: false,
        }
      }
      templateMatchedByIndex.add(i)
      return
    }
    result.push({...cell, hidden: false})
  })

  return {
    nextCells: result,
    mergeMatchedCount: templateMatchedByIndex.size,
  }
}
