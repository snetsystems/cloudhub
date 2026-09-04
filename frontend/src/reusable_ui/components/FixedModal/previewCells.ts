import {Cell} from 'src/types'
import {CellType} from 'src/types/dashboards'
import {ImportSelectionPayload} from 'src/shared/types/importModal'

export interface PreviewCellItem {
  key: string
  cell: Cell
}

/** LayoutCell shows “Add Data” when there is no runnable query. */
export function hasRunnableQuery(cell: {
  queries?: Array<{
    query?: string
    text?: string
    queryConfig?: {rawText?: string}
  }>
}): boolean {
  const queries = cell.queries ?? []
  return queries.some(q => {
    const text = (q.query || q.text || q.queryConfig?.rawText || '').trim()
    return text.length > 0
  })
}

export function getPreviewCellsFromSelection(
  selection: ImportSelectionPayload
): PreviewCellItem[] {
  const fromDashboards = (selection.dashboards ?? []).flatMap(d =>
    (d.cells ?? []).map(cell => ({
      key: `${d.id}::${cell.i}`,
      cell,
    }))
  )
  const fromLibrary = (selection.libraryCells ?? []).map(lc => {
    const content = (lc.content || {}) as Cell
    return {
      key: `library::${lc.id}`,
      cell: {
        ...content,
        // Library saves often omit layout id; GridLayout needs a stable `i`.
        i: content.i || lc.id,
        name: content.name || lc.name,
        type: content.type || (lc.type as CellType),
      },
    }
  })
  return [...fromDashboards, ...fromLibrary]
}

/**
 * Preview card height in px, derived from the cell's own grid height so tall
 * cells (the optics table needs room for its toolbar and two header rows) are
 * not clipped, while ordinary graph cells keep the previous 220px card.
 */
export function previewCardHeight(cell: Cell): number {
  const rows = cell.h ?? 4
  return Math.min(Math.max(rows * 14, 220), 440)
}

export function normalizeCellForPreview(cell: Cell): Cell {
  return {
    ...cell,
    i: cell.i || 'preview-cell',
    inView: true,
    x: 0,
    y: 0,
    w: 96,
    // Single-cell preview; CSS stretches the grid item to the card height.
    h: 1,
    queries: (cell.queries ?? []).map(q => ({
      ...q,
      text: q.query || q.text,
      queryConfig: {
        ...q.queryConfig,
        rawText: q.query || q.text || '',
      },
    })),
  }
}
