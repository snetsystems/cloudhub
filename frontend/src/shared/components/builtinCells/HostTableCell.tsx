// Libraries
import React, {FunctionComponent} from 'react'
import _ from 'lodash'

// Components
import HostTable from 'src/hosts/components/HostsTable'

// Types
import {
  BuiltinCellComponentProps,
  BuiltinCellRegistryEntry,
  BuiltinCellPropsProvider,
  BUILTIN_CELL_IDS,
  registerBuiltinCell,
} from 'src/shared/components/BuiltinCellRegistry'
import {Host, RemoteDataState} from 'src/types'

/**
 * Cell ID for this builtin component.
 * Must match the cell.i value in the backend JSON.
 */
export const CELL_ID = BUILTIN_CELL_IDS.HOST_TABLE_CELL

/**
 * Props required by HostTableCell component.
 * This type defines what props the container must provide for this cell.
 */
export interface HostTableCellProps {
  hostsObject: {[x: string]: Host}
  hostPageStatus: RemoteDataState
  onClickTableRow: (hostName: string) => () => void
  tableTitle: () => JSX.Element
  host?: string
}

/**
 * HostTableCell is an adapter component that wraps HostTable for use in BuiltinCellRenderer.
 * It receives BuiltinCellComponentProps (cell, source, timeRange) plus HostTableCellProps.
 */
const HostTableCell: FunctionComponent<
  BuiltinCellComponentProps & HostTableCellProps
> = ({
  source,
  hostsObject,
  hostPageStatus,
  host,
  onClickTableRow,
  tableTitle,
}) => {
  return (
    <HostTable
      source={source}
      hosts={
        hostsObject && typeof hostsObject === 'object'
          ? _.values(hostsObject as {[x: string]: Host})
          : []
      }
      hostPageStatus={
        (hostPageStatus as RemoteDataState) || RemoteDataState.NotStarted
      }
      focusedHost={(host as string) || ''}
      onClickTableRow={onClickTableRow}
      tableTitle={(tableTitle as () => JSX.Element) || (() => <></>)}
    />
  )
}

/**
 * Container props type that HostTableCell requires.
 * Container must provide all these props for this cell to work.
 */
export interface HostTableCellContainerProps {
  hostsObject: {[x: string]: Host}
  hostPageStatus: RemoteDataState
  onClickTableRow: (hostName: string) => () => void
  tableTitle: () => JSX.Element
  focusedHost: string
}

/**
 * Props provider function for HostTableCell.
 * Extracts required props from container's available data.
 * Container calls this function to get the props this cell needs.
 */
export const getHostTableCellProps: BuiltinCellPropsProvider<
  HostTableCellProps,
  HostTableCellContainerProps
> = (containerProps: HostTableCellContainerProps): HostTableCellProps => {
  return {
    hostsObject: containerProps.hostsObject,
    hostPageStatus: containerProps.hostPageStatus,
    onClickTableRow: containerProps.onClickTableRow,
    tableTitle: containerProps.tableTitle,
    host: containerProps.focusedHost,
  }
}

/**
 * Required props for HostTableCell.
 * Container must provide these props in containerProps.
 * This is exported so developers can see what props are needed.
 */
export const HOST_TABLE_CELL_REQUIRED_PROPS: (keyof HostTableCellProps)[] = [
  'hostsObject',
  'hostPageStatus',
  'onClickTableRow',
  'tableTitle',
  'host',
]

/**
 * Registry metadata for this builtin cell component.
 * The getProps function allows the container to automatically inject required props.
 * requiredProps는 타입 안전하게 선언되어 Container에서 어떤 props를 제공해야 하는지 알 수 있습니다.
 * 
 * 개발자가 Container에서 어떤 props를 제공해야 하는지 확인하려면:
 * - registryEntry.requiredProps를 확인
 * - 또는 HOST_TABLE_CELL_REQUIRED_PROPS를 import하여 확인
 */
const registryEntry: BuiltinCellRegistryEntry<HostTableCellProps> = {
  component: HostTableCell,
  description: '호스트 목록을 표시하는 테이블 컴포넌트',
  defaultSize: {w: 12, h: 8},
  propsType: {} as HostTableCellProps, // 타입 정보를 위한 placeholder
  requiredProps: HOST_TABLE_CELL_REQUIRED_PROPS,
  getProps: getHostTableCellProps,
}

/**
 * Initialize and register this builtin cell component in the registry.
 * This function should be called in the container component that uses this cell.
 * 
 * This function is idempotent - it's safe to call multiple times.
 * 
 * @example
 * // Class component:
 * import {initHostTableCell} from 'src/shared/components/builtinCells/HostTableCell'
 * 
 * constructor(props: Props) {
 *   super(props)
 *   initHostTableCell() // Call in constructor
 * }
 * 
 * @example
 * // Functional component:
 * import {useEffect} from 'react'
 * import {initHostTableCell} from 'src/shared/components/builtinCells/HostTableCell'
 * 
 * function MyContainer() {
 *   useEffect(() => {
 *     initHostTableCell() // Call in useEffect
 *   }, []) // Empty dependency array - run once on mount
 *   
 *   return <div>...</div>
 * }
 */
export function initHostTableCell(): void {
  registerBuiltinCell(CELL_ID, registryEntry)
}

export default HostTableCell
