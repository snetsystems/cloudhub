import {useEffect, useState, useMemo} from 'react'
import {Cell} from 'src/types'
import {ImportSelectionPayload} from 'src/shared/types/importModal'
import * as DashboardsModels from 'src/types/dashboards'
import {
  addDashboardCellAsync,
  cloneDashboardCellAsync,
  deleteDashboardCellAsync,
  updateDashboard,
  getDashboardsAsync,
  patchDashboardByIDAsync,
} from 'src/dashboards/actions'
import {notify} from 'src/shared/actions/notifications'
import {
  notifyCellsImportedAdded,
  notifyCellsImportedUpdated,
  notifyCellsImportedMixed,
} from 'src/shared/copy/notifications'
import {computeNextCells} from 'src/dashboards/utils/importCells'

export type FetchDashboardByName = (
  name: string
) => Promise<DashboardsModels.Dashboard | null>

export interface UseDashboardPageWithImportArgs {
  pageName: string
  fetchDashboardByName: FetchDashboardByName
  dashboards: DashboardsModels.Dashboard[] | undefined
  getDashboardsAsync: typeof getDashboardsAsync
  updateDashboard: typeof updateDashboard
  putDashboard: (dashboard: DashboardsModels.Dashboard) => void | Promise<void>
  patchDashboardByIDAsync: typeof patchDashboardByIDAsync
  addDashboardCellAsync: typeof addDashboardCellAsync
  cloneDashboardCellAsync: typeof cloneDashboardCellAsync
  deleteDashboardCellAsync: typeof deleteDashboardCellAsync
  dispatch: (action: unknown) => Promise<unknown>
}

export interface UseDashboardPageWithImportResult {
  dashboard: DashboardsModels.Dashboard | undefined
  cells: Cell[]
  loadSettled: boolean
  onPositionChange: (newCells: Cell[]) => void
  onAddCell: (cell: Cell) => void
  onDeleteCell: (cell: Cell) => void
  onCloneCell: (cell: Cell) => void
  importModal: {
    isOpen: boolean
    setIsOpen: (value: boolean | ((prev: boolean) => boolean)) => void
    onSelectionChange: (items: ImportSelectionPayload) => Promise<void>
  }
}

export function useDashboardPageWithImport(
  args: UseDashboardPageWithImportArgs
): UseDashboardPageWithImportResult {
  const {
    pageName,
    fetchDashboardByName,
    dashboards,
    getDashboardsAsync,
    updateDashboard,
    putDashboard,
    patchDashboardByIDAsync,
    addDashboardCellAsync,
    cloneDashboardCellAsync,
    deleteDashboardCellAsync,
    dispatch,
  } = args

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cells, setCells] = useState<Cell[]>([])
  const [currentDashboardId, setCurrentDashboardId] = useState<string>('')
  const [loadSettled, setLoadSettled] = useState(false)

  const patchDashboardByIDAsyncBound = patchDashboardByIDAsync as unknown as (
    dashboardID: string,
    cells: Cell[]
  ) => Promise<DashboardsModels.Dashboard | undefined>

  const dashboard = useMemo(() => {
    if (!dashboards || !currentDashboardId) return undefined
    return dashboards.find(d => String(d.id) === String(currentDashboardId))
  }, [dashboards, currentDashboardId])

  useEffect(() => {
    if (dashboard?.cells) setCells(dashboard.cells)
  }, [dashboard])

  useEffect(() => {
    if (!dashboard?.templates?.length) return
    setLocalTemplates(prev => {
      const byKey = new Map(prev.map(t => [t.tempVar || t.id, t]))
      dashboard.templates!.forEach(t => {
        const k = t.tempVar || t.id
        if (k && !byKey.has(k)) byKey.set(k, t)
      })
      return Array.from(byKey.values())
    })
  }, [dashboard?.id, dashboard?.templates?.length])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const dashboardByName = await fetchDashboardByName(pageName)
        if (!cancelled && dashboardByName) {
          setCurrentDashboardId(dashboardByName.id)
        }
      } catch (_) {
        if (!cancelled) setCurrentDashboardId('')
      } finally {
        if (!cancelled) setLoadSettled(true)
      }
    }
    load()
    getDashboardsAsync()
    return () => {
      cancelled = true
    }
  }, [pageName, fetchDashboardByName, getDashboardsAsync])

  const onAddCell = (cell: Cell) => {
    if (!dashboard) return
    addDashboardCellAsync(dashboard, cell)
  }

  const onDeleteCell = (cell: Cell) => {
    if (!dashboard) return
    deleteDashboardCellAsync(dashboard, cell)
  }

  const onCloneCell = (cell: Cell) => {
    if (!dashboard) return
    cloneDashboardCellAsync(dashboard, cell)
  }

  const onPositionChange = (newCells: Cell[]) => {
    if (!dashboard) return
    const newDashboard = {...dashboard, cells: newCells}
    updateDashboard(newDashboard)
    putDashboard(newDashboard)
  }

  const handleSelectionChange = async (items: ImportSelectionPayload) => {
    const dashboardCells = items.dashboards.flatMap(d => d.cells)
    if (dashboardCells.length === 0 || !currentDashboardId) return

    const {nextCells, mergeMatchedCount} = computeNextCells(
      cells,
      dashboardCells,
      items.importStrategy
    )
    const count = dashboardCells.length

    let updated: DashboardsModels.Dashboard | undefined
    try {
      updated = await patchDashboardByIDAsyncBound(currentDashboardId, nextCells)
      if (updated?.cells && String(updated.id) === String(currentDashboardId)) {
        const cellsToSet = updated.cells
        setTimeout(() => setCells(cellsToSet), 0)
      }
    } finally {
      if (count > 0) {
        const runNotify = () => {
          if (items.importStrategy === 'mergeByCellId') {
            const updatedCount = mergeMatchedCount
            const addedCount = count - updatedCount
            if (addedCount > 0 && updatedCount > 0) {
              dispatch(
                notify(notifyCellsImportedMixed(addedCount, updatedCount))
              )
            } else if (updatedCount > 0) {
              dispatch(notify(notifyCellsImportedUpdated(updatedCount)))
            } else {
              dispatch(notify(notifyCellsImportedAdded(addedCount)))
            }
          } else {
            dispatch(notify(notifyCellsImportedAdded(count)))
          }
        }
        setTimeout(runNotify, 0)
      }
    }
  }

  return {
    dashboard,
    cells,
    loadSettled,
    onPositionChange,
    onAddCell,
    onDeleteCell,
    onCloneCell,
    importModal: {
      isOpen: isModalOpen,
      setIsOpen: setIsModalOpen,
      onSelectionChange: handleSelectionChange,
    },
  }
}
