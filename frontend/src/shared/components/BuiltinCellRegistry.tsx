// Libraries
import {ComponentType} from 'react'

// Components
import HostTableCell from 'src/shared/components/builtinCells/HostTableCell'

// Types
import {Cell, CellType} from 'src/types/dashboards'
import {Source, TimeRange, Host, RemoteDataState} from 'src/types'

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
 * HostTableCellProps defines the props required by HostTableCell component.
 */
export interface HostTableCellProps {
  hostsObject: {[x: string]: Host}
  hostPageStatus: RemoteDataState
  onClickTableRow: (hostName: string) => () => void
  tableTitle: () => JSX.Element
  host?: string
}

/**
 * CellTypeToProps maps cell types to their required props types.
 * This enables TypeScript to enforce required props for each cell type.
 * Note: This is for documentation purposes. Props are passed directly to components.
 */
export type CellTypeToProps = {
  [CellType.HostTable]: HostTableCellProps
  // Add more cell type props here as needed
  // [CellType.AWSInstances]: AWSInstancesCellProps
}

/**
 * BuiltinCellRegistryEntry defines the structure of a builtin cell component registration.
 */
export interface BuiltinCellRegistryEntry {
  component: ComponentType<BuiltinCellComponentProps>
  description: string
  defaultSize?: {w: number; h: number}
}

/**
 * BuiltinCellRegistry maps cell types to their corresponding React components.
 * This registry allows for easy extension with new builtin cell types.
 */
export const BUILTIN_CELL_REGISTRY: Record<string, BuiltinCellRegistryEntry> = {
  [CellType.HostTable]: {
    component: HostTableCell,
    description: '호스트 목록을 표시하는 테이블 컴포넌트',
    defaultSize: {w: 12, h: 8},
  },
  // Add more builtin cell types here as needed
  // [CellType.AWSInstances]: {
  //   component: AWSInstancesTableCell,
  //   description: 'AWS 인스턴스 목록',
  //   defaultSize: {w: 12, h: 8},
  // },
}

/**
 * Get builtin cell component by cell type or cell ID.
 * Returns null if no matching component is found.
 */
export function getBuiltinCellComponent(
  cell: Cell
): BuiltinCellRegistryEntry | null {
  // Try by cell type first (more explicit)
  if (cell.type && BUILTIN_CELL_REGISTRY[cell.type]) {
    return BUILTIN_CELL_REGISTRY[cell.type]
  }

  // Fallback: try by cell ID (for backward compatibility)
  // Map known cell IDs to their types
  const cellIdToTypeMap: Record<string, string> = {
    'host-table-cell': CellType.HostTable,
  }

  const mappedType = cellIdToTypeMap[cell.i]
  if (mappedType && BUILTIN_CELL_REGISTRY[mappedType]) {
    return BUILTIN_CELL_REGISTRY[mappedType]
  }

  return null
}

/**
 * Check if a cell is a builtin cell type.
 */
export function isBuiltinCell(cell: Cell): boolean {
  return getBuiltinCellComponent(cell) !== null
}
