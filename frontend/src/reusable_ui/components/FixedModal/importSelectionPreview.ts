import {Cell} from 'src/types'
import {ImportSelectionPayload} from 'src/shared/types/importModal'

export interface PreviewCellItem {
  key: string
  cell: Cell
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
        type: content.type || lc.type,
      },
    }
  })
  return [...fromDashboards, ...fromLibrary]
}

export function normalizeCellForPreview(cell: Cell): Cell {
  return {
    ...cell,
    i: cell.i || 'preview-cell',
    inView: true,
    x: 0,
    y: 0,
    w: 96,
    h: 14,
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
