import {Cell} from 'src/types'
import {ImportStrategy} from 'src/shared/types/importModal'
import {CellOrigin} from 'src/types/dashboards'

/**
 * Computes the next cells array after import: either merge by cell id/name or append.
 * For mergeByCellId (Fixed Cell): builtin cells that already exist on the dashboard
 * only have visibility (hidden: false) updated; no add/overwrite of content.
 */
export function computeNextCells(
  currentCells: Cell[],
  importedCells: Cell[],
  strategy: ImportStrategy
): {nextCells: Cell[]; mergeMatchedCount: number} {
  if (strategy !== 'mergeByCellId') {
    return {nextCells: [...currentCells, ...importedCells], mergeMatchedCount: 0}
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
