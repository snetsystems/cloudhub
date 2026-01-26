// Libraries
import {ComponentType} from 'react'

// Types
import {Cell} from 'src/types/dashboards'
import {Source, TimeRange} from 'src/types'

/**
 * BuiltinCellComponentProps defines the common props that all builtin cell components receive.
 * Each component can extend this interface with its own specific props.
 */
export interface BuiltinCellComponentProps {
  cell: Cell
  source: Source
  timeRange: TimeRange
  [key: string]: any // Allow additional props for component-specific needs
}

/**
 * Props provider function type.
 * Each builtin cell provides a function that extracts required props from container's available data.
 * This allows cells to declare what they need, and containers to provide it automatically.
 * 
 * @template T - The props type that this cell returns
 * @template C - The container props type that this cell requires
 */
export type BuiltinCellPropsProvider<T = any, C = {[key: string]: any}> = (
  containerProps: C
) => T

/**
 * BuiltinCellRegistryEntry defines the structure of a builtin cell component registration.
 * Each entry includes the component, metadata, and a props provider function.
 * 
 * @template T - The props type that this cell requires from the container
 */
export interface BuiltinCellRegistryEntry<T = any> {
  component: ComponentType<BuiltinCellComponentProps>
  description: string
  defaultSize?: {w: number; h: number}
  requiredProps?: (keyof T)[] // List of required prop names (typed)
  getProps?: BuiltinCellPropsProvider<T> // Function to extract required props from container
  propsType?: T // Props type for type checking and documentation
}

/**
 * Builtin Cell IDs
 * Each builtin cell must have a unique ID that matches cell.i in backend JSON.
 */
export const BUILTIN_CELL_IDS = {
  HOST_TABLE_CELL: 'host-table-cell',
  // Add more cell IDs here as needed
} as const

export type BuiltinCellId = typeof BUILTIN_CELL_IDS[keyof typeof BUILTIN_CELL_IDS]

/**
 * BuiltinCellRegistry maps cell IDs (cell.i) to their corresponding React components.
 * 
 * This registry is populated by calling init functions in container components.
 * Each builtin cell component exports an init function (e.g., `initHostTableCell()`)
 * that should be called in the container component's constructor (class) or useEffect (functional).
 * 
 * Naming Convention: `{component-name}-cell` (e.g., `"host-table-cell"`)
 * 
 * Each entry's `requiredProps` field shows what props the container must provide.
 * Check registryEntry.requiredProps to see what props are needed for each cell.
 */
export const BUILTIN_CELL_REGISTRY: Record<
  string,
  BuiltinCellRegistryEntry<any>
> = {}

/**
 * Register a builtin cell component in the registry.
 * This is an internal function used by init functions exported from builtin cell components.
 * 
 * @param cellId - The cell ID (must match cell.i in backend JSON)
 * @param entry - The registry entry containing component and metadata
 */
export function registerBuiltinCell(
  cellId: string,
  entry: BuiltinCellRegistryEntry
): void {
  if (BUILTIN_CELL_REGISTRY[cellId]) {
    console.warn(
      `Builtin cell with ID "${cellId}" is already registered. Overwriting...`
    )
  }
  BUILTIN_CELL_REGISTRY[cellId] = entry
}

/**
 * Get builtin cell component by cell ID (cell.i).
 * Returns null if no matching component is found.
 */
export function getBuiltinCellComponent(
  cell: Cell
): BuiltinCellRegistryEntry | null {
  if (cell.i && BUILTIN_CELL_REGISTRY[cell.i]) {
    return BUILTIN_CELL_REGISTRY[cell.i]
  }

  return null
}

/**
 * Check if a cell is a builtin cell type.
 */
export function isBuiltinCell(cell: Cell): boolean {
  return getBuiltinCellComponent(cell) !== null
}
