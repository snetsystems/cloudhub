import {useEffect, useState, useMemo, useRef} from 'react'
import {Cell, Template} from 'src/types'
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
  localTemplates: Template[]
  onPositionChange: (newCells: Cell[]) => void
  onAddCell: (cell: Cell) => void
  onDeleteCell: (cell: Cell) => void
  onHideCell: (cell: Cell) => void
  onShowCell: (cell: Cell) => void
  onCloneCell: (cell: Cell) => void
  onShowInformation: (cell: Cell) => void
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localTemplates, setLocalTemplates] = useState<Template[]>([])

  const patchDashboardByIDAsyncBound = (patchDashboardByIDAsync as unknown) as (
    dashboardID: string,
    cells: Cell[]
  ) => Promise<DashboardsModels.Dashboard | undefined>

  const dashboard = useMemo(() => {
    if (!dashboards || !currentDashboardId) return undefined
    return dashboards.find(d => String(d.id) === String(currentDashboardId))
  }, [dashboards, currentDashboardId])

  const cellsRef = useRef<Cell[]>([])
  const dashboardRef = useRef<DashboardsModels.Dashboard | undefined>(undefined)

  useEffect(() => {
    cellsRef.current = cells
  }, [cells])

  useEffect(() => {
    dashboardRef.current = dashboard
    if (dashboard?.cells) setCells(dashboard.cells)
  }, [dashboard])

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

  const onShowInformation = (cell: Cell) => {
    if (!dashboard) return
    const nextCells = cells.map(c => {
      if (c.i === cell.i) {
        return {
          ...c,
          isShowSummary: !c.isShowSummary,
        }
      }
      return c
    })
    onPositionChange(nextCells)
  }

  const onPositionChange = (newCells: Cell[]) => {
    const currentDashboard = dashboardRef.current
    const currentCells = cellsRef.current

    if (!currentDashboard) return

    // LayoutRenderer may pass only visible cells. We must not silently drop hidden cells.
    // We merge the newCells (which may have updated x, y, h, w) with the existing cells.
    const mergedCells = currentCells.map(c => {
      const updated = newCells.find(nc => String(nc.i) === String(c.i))
      return updated ? updated : c
    })

    // Plus any brand new cells that weren't in the original array
    const existingIds = new Set(currentCells.map(c => String(c.i)))
    const addedCells = newCells.filter(nc => !existingIds.has(String(nc.i)))

    const finalCells = [...mergedCells, ...addedCells]

    const newDashboard = {...currentDashboard, cells: finalCells}
    updateDashboard(newDashboard)
    putDashboard(newDashboard)
  }

  /** Hides a cell from the dashboard (sets hidden: true) without deleting from ETCD. */
  const onHideCell = (cell: Cell) => {
    if (!dashboard) return
    const newCells = cells.map(c => (c.i === cell.i ? {...c, hidden: true} : c))
    onPositionChange(newCells)
  }

  /** Shows a previously hidden cell (sets hidden: false). */
  const onShowCell = (cell: Cell) => {
    if (!dashboard) return
    const newCells = cells.map(c =>
      c.i === cell.i ? {...c, hidden: false} : c
    )
    onPositionChange(newCells)
  }

  const handleSelectionChange = async (items: ImportSelectionPayload) => {
    const dashboardCells = [
      ...items.dashboards.flatMap(d => d.cells),
      ...(items.libraryCells ?? []).map(lc => lc.content),
    ]
    if (dashboardCells.length === 0 || !currentDashboardId) return

    // For builtin dashboards, use full cell list (including hidden) so import only toggles visibility and does not run "add" logic
    const isBuiltin = dashboard?.type === DashboardsModels.DashboardType.Builtin
    const currentCellsForMerge =
      isBuiltin && items.importStrategy === 'mergeByCellId'
        ? (await fetchDashboardByName(pageName))?.cells ?? cells
        : cells

    const {nextCells, mergeMatchedCount} = computeNextCells(
      currentCellsForMerge,
      dashboardCells,
      items.importStrategy
    )
    const count = dashboardCells.length

    let updated: DashboardsModels.Dashboard | undefined
    try {
      updated = await patchDashboardByIDAsyncBound(
        currentDashboardId,
        nextCells
      )
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
    localTemplates,
    onPositionChange,
    onAddCell,
    onDeleteCell,
    onHideCell,
    onShowCell,
    onCloneCell,
    onShowInformation,
    importModal: {
      isOpen: isModalOpen,
      setIsOpen: setIsModalOpen,
      onSelectionChange: handleSelectionChange,
    },
  }
}
