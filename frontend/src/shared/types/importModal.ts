import {Dashboard, CellType, DashboardItem} from 'src/types/dashboards'
import {Template} from 'src/types/tempVars'

export type ImportStrategy = 'mergeByCellId' | 'append'

export interface ImportSelectionPayload {
  dashboards: Dashboard[]
  cellTypes: CellType[]
  /** Selected items from dashboard-items API (Cell List tab). */
  dashboardItems?: DashboardItem[]
  templates: Template[]
  importStrategy: ImportStrategy
}
