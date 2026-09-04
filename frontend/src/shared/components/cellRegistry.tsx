import React from 'react'

import OpticsCellContent from 'src/device_management/components/OpticsCellContent'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import * as DashboardsModels from 'src/types/dashboards'

/**
 * Components for builtin cells of `type: "component"`, keyed by cell id.
 * A cell id that is not registered falls through to the normal graph rendering.
 */
const CELL_COMPONENTS: Record<
  string,
  React.ComponentType<{
    cell: DashboardsModels.Cell
    context: RenderCellContext
  }>
> = {
  'snmp-optics': OpticsCellContent,
}

/**
 * Importing a cell rewrites its id to `<original id>-import-<ts>-<rand>`
 * (see src/dashboards/utils/importCells), so an exact lookup misses imported
 * copies. Match the original id as well.
 */
const resolveComponent = (cellID: string) => {
  if (CELL_COMPONENTS[cellID]) {
    return CELL_COMPONENTS[cellID]
  }
  const registeredID = Object.keys(CELL_COMPONENTS).find(id =>
    cellID.startsWith(`${id}-import-`)
  )
  return registeredID ? CELL_COMPONENTS[registeredID] : undefined
}

/** renderCell implementation for LayoutRenderer; returns null when unregistered. */
export const renderRegisteredCell = (
  cell: DashboardsModels.Cell,
  context: RenderCellContext
): JSX.Element | null => {
  const Component = resolveComponent(cell.i ?? '')
  if (!Component) {
    return null
  }
  return <Component cell={cell} context={context} />
}

export default renderRegisteredCell
