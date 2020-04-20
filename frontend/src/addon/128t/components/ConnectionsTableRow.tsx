// Libraries
import React, {PureComponent} from 'react'

// Components
import {
  TableBodyRowItem,
  numberWithCommas,
} from 'src/addon/128t/reusable/layout'

// Constants
import {CONNECTION_TABLE_SIZING} from 'src/addon/128t/constants'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

import {Connection} from 'src/addon/128t/types'

interface Props {
  connection: Connection
}

@ErrorHandling
class ConnectionsTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const {connection} = this.props
    const {
      CONNECTION_PATH_ID,
      CONNECTION_CONNECTED,
      CONNECTION_DISCONNECTED,
      CONNECTION_IN_USER,
      CONNECTION_DATA_COUNT,
      CONNECTION_SPEED,
    } = CONNECTION_TABLE_SIZING
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={connection.pathId}
          width={CONNECTION_PATH_ID}
          className={'align--start'}
        />
        <TableBodyRowItem
          title={numberWithCommas(connection.connected)}
          width={CONNECTION_CONNECTED}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={numberWithCommas(connection.disconnected)}
          width={CONNECTION_DISCONNECTED}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={numberWithCommas(connection.inUse)}
          width={CONNECTION_IN_USER}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={numberWithCommas(connection.processDataCount)}
          width={CONNECTION_DATA_COUNT}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={numberWithCommas(connection.processSpeed)}
          width={CONNECTION_SPEED}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default ConnectionsTableRow
