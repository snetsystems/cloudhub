// Libraries
import React, {FunctionComponent} from 'react'
import _ from 'lodash'

// Components
import HostTable from 'src/hosts/components/HostsTable'

// Types
import {BuiltinCellComponentProps} from 'src/shared/components/BuiltinCellRegistry'
import {Host, RemoteDataState} from 'src/types'

/**
 * HostTableCell is an adapter component that wraps HostTable for use in BuiltinCellRenderer.
 * It converts BuiltinCellComponentProps to HostTable's specific props.
 */
const HostTableCell: FunctionComponent<BuiltinCellComponentProps> = ({
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

export default HostTableCell
