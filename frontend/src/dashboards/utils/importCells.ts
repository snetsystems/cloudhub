import {Cell} from 'src/types'
import {ImportStrategy} from 'src/shared/types/importModal'

/**
 * Computes the next cells array after import: either merge by cell id/name or append.
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
      result.push({...existing, queries: templateById.queries})
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
      result.push({...existing, queries: templateByName.queries})
      continue
    }
    result.push(existing)
  }

  importedCells.forEach((cell, i) => {
    if (templateMatchedByIndex.has(i)) return
    const idK = key(cell.i)
    const existingResultIndex = result.findIndex(c => key(c.i) === idK)
    if (existingResultIndex !== -1) {
      result[existingResultIndex] = {
        ...result[existingResultIndex],
        queries: cell.queries,
        name: cell.name,
      }
      templateMatchedByIndex.add(i)
      return
    }
    result.push(cell)
  })

  return {
    nextCells: result,
    mergeMatchedCount: templateMatchedByIndex.size,
  }
}
