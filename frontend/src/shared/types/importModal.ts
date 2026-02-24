import {Dashboard, CellType} from 'src/types/dashboards'
import {Template} from 'src/types/tempVars'

export type ImportStrategy = 'mergeByCellId' | 'append'

export interface ImportSelectionPayload {
  dashboards: Dashboard[]
  cellTypes: CellType[]
  templates: Template[]
  importStrategy: ImportStrategy
}
