import React from 'react'
import {TOPSESSIONS_TABLE_SIZING} from 'src/addon/128t/constants'
import {TopSession} from 'src/addon/128t/types'
import {TableBodyRowItem} from 'src/addon/128t/reusable/layout'

interface Props {
  topSessions: TopSession
}

const TopSessionsTableRow = ({topSessions}: Props) => {
  const {service, tenant, value, protocol, source, destination} = topSessions

  const {
    TOPSESSION_SERVICE,
    TOPSESSION_TENANT,
    TOPSESSION_VALUE,
    TOPSESSION_PROTOCOL,
    TOPSESSION_SOURCE_ADDRESS,
    TOPSESSION_SOURCE_PORT,
    TOPSESSION_DESTINATION_ADDRESS,
    TOPSESSION_DESTINATION_PORT,
  } = TOPSESSIONS_TABLE_SIZING

  return (
    <div className={'hosts-table--tr'}>
      <TableBodyRowItem
        title={service}
        width={TOPSESSION_SERVICE}
        className={'align--start'}
      />
      <TableBodyRowItem
        title={tenant}
        width={TOPSESSION_TENANT}
        className={''}
      />

      <TableBodyRowItem
        title={value}
        width={TOPSESSION_VALUE}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={protocol}
        width={TOPSESSION_PROTOCOL}
        className={'align--start'}
      />
      <TableBodyRowItem
        title={source.address}
        width={TOPSESSION_SOURCE_ADDRESS}
        className={'align--start'}
      />
      <TableBodyRowItem
        title={source.port}
        width={TOPSESSION_SOURCE_PORT}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={destination.address}
        width={TOPSESSION_DESTINATION_ADDRESS}
        className={'align--start'}
      />
      <TableBodyRowItem
        title={destination.port}
        width={TOPSESSION_DESTINATION_PORT}
        className={'align--end'}
      />
    </div>
  )
}

export default TopSessionsTableRow
