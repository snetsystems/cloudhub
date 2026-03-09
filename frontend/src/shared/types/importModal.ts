import {Dashboard, CellType, LibraryCell} from 'src/types/dashboards'
import {Template} from 'src/types/tempVars'

export type ImportStrategy = 'mergeByCellId' | 'append'

export interface ImportSelectionPayload {
  dashboards: Dashboard[]
  cellTypes: CellType[]
  /** Selected items from cell-library API (Cell List tab). */
  libraryCells?: LibraryCell[]
  templates: Template[]
  importStrategy: ImportStrategy
}
